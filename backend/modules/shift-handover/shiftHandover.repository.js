"use strict";

const { getClient, query } = require("../../database/postgreDB/pg");
const { formatDate } = require("../tools");
const { PAYMENT_METHODS } = require("./shiftHandover.validator");
const {
  createPaymentBuckets,
  normalizeAmount
} = require("./shiftHandover.calculator");

const PAYMENT_TYPE_MAPPING = { "现金": 1, "微信": 2, "微邮付": 3, "其他": 4 };
const PAYMENT_TYPE_REVERSE = { 1: "现金", 2: "微信", 3: "微邮付", 4: "其他" };

async function getSpecialStats(date) {
  const roomSql = `
    SELECT
      COUNT(*) FILTER (
        WHERE stay_type = '客房'
          AND check_in_date <= $1::date
          AND check_out_date > $1::date
      ) AS open_count,
      COUNT(*) FILTER (
        WHERE stay_type = '休息房'
          AND check_in_date = $1::date
          AND check_out_date = $1::date
      ) AS rest_count
    FROM orders
    WHERE stay_type IN ('客房', '休息房')
      AND status NOT IN ('cancelled');
  `;

  const reviewSql = `
    SELECT
      COUNT(*) AS invited,
      COUNT(*) FILTER (WHERE positive_review = true) AS positive
    FROM review_invitations
    WHERE invite_time::date = $1::date
  `;

  const [roomResult, reviewResult] = await Promise.all([
    query(roomSql, [date]),
    query(reviewSql, [date])
  ]);

  return {
    openCount: parseInt(roomResult.rows[0].open_count) || 0,
    restCount: parseInt(roomResult.rows[0].rest_count) || 0,
    invited: parseInt(reviewResult.rows[0].invited) || 0,
    positive: parseInt(reviewResult.rows[0].positive) || 0
  };
}

async function listCompletedHandoverRecords() {
  const sql = `
    SELECT
      date::text as date,
      COUNT(DISTINCT payment_type) as payment_count,
      MIN(handover_person) as handover_person,
      MIN(takeover_person) as takeover_person,
      SUM(CASE WHEN payment_type = 1 THEN vip_card ELSE 0 END) as vip_cards,
      (SELECT task_list FROM handover h2 WHERE h2.date = h1.date AND h2.payment_type = 1 LIMIT 1) as task_list,
      (SELECT remarks FROM handover h3 WHERE h3.date = h1.date AND h3.payment_type = 1 LIMIT 1) as remarks
    FROM handover h1
    WHERE payment_type IN (1, 2, 3, 4)
    GROUP BY date
    HAVING COUNT(DISTINCT payment_type) = 4
    ORDER BY date DESC
  `;

  const result = await query(sql);

  return result.rows.map(row => ({
    date: row.date,
    handoverPerson: row.handover_person || "",
    takeoverPerson: row.takeover_person || "",
    vipCards: parseInt(row.vip_cards) || 0,
    taskList: row.task_list || [],
    remarks: row.remarks || "",
    paymentCount: parseInt(row.payment_count) || 0
  }));
}

/**
 * 保存完成交接及其来源快照；两类数据必须同事务提交，避免历史金额失去可追溯依据。
 */
async function saveCompletedHandover({ date, operatorName, receivePerson, vipCard, notes, paymentData, sourceDetails }) {
  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");

    const insertSQL = `
      INSERT INTO handover (
        date, handover_person, takeover_person, vip_card, payment_type,
        reserve_cash, room_income, rest_income, rent_income, total_income,
        room_refund, rest_refund, retained, handover, source_snapshot_created,
        task_list, remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, $15, $16)
      ON CONFLICT (date, payment_type) DO UPDATE SET
        handover_person = EXCLUDED.handover_person,
        takeover_person = EXCLUDED.takeover_person,
        vip_card = EXCLUDED.vip_card,
        reserve_cash = EXCLUDED.reserve_cash,
        room_income = EXCLUDED.room_income,
        rest_income = EXCLUDED.rest_income,
        rent_income = EXCLUDED.rent_income,
        total_income = EXCLUDED.total_income,
        room_refund = EXCLUDED.room_refund,
        rest_refund = EXCLUDED.rest_refund,
        retained = EXCLUDED.retained,
        handover = EXCLUDED.handover,
        source_snapshot_created = true,
        task_list = EXCLUDED.task_list,
        remarks = EXCLUDED.remarks
      RETURNING *;
    `;

    const results = await Promise.all(
      PAYMENT_METHODS.map(method => {
        const values = [
          date,
          operatorName,
          receivePerson.trim(),
          method === "现金" ? vipCard : 0,
          PAYMENT_TYPE_MAPPING[method],
          paymentData.reserve?.[method] || 0,
          paymentData.hotelIncome?.[method] || 0,
          paymentData.restIncome?.[method] || 0,
          paymentData.carRentIncome?.[method] || 0,
          paymentData.totalIncome?.[method] || 0,
          paymentData.hotelDeposit?.[method] || 0,
          paymentData.restDeposit?.[method] || 0,
          paymentData.retainedAmount?.[method] || 0,
          paymentData.handoverAmount?.[method] || 0,
          "[]",
          method === "现金" ? (notes || "") : ""
        ];
        return client.query(insertSQL, values);
      })
    );

    await client.query(
      "DELETE FROM handover_source_snapshot WHERE business_date = $1::date",
      [date]
    );

    if (sourceDetails.length > 0) {
      const snapshotSql = `
        INSERT INTO handover_source_snapshot (
          business_date, source_item, payment_method, bill_id, order_id,
          room_number, guest_name, change_type, source_amount,
          bill_create_time, remarks
        ) VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      await Promise.all(sourceDetails.map((detail) => client.query(snapshotSql, [
        date,
        detail.item,
        detail.paymentMethod,
        detail.billId,
        detail.orderId,
        detail.roomNumber,
        detail.guestName,
        detail.changeType,
        detail.amount,
        detail.createTime,
        detail.remarks
      ])));
    }

    await client.query("COMMIT");
    return results.flatMap(result => result.rows);
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
        console.warn("事务已回滚");
      } catch (rollbackError) {
        console.error("回滚事务失败:", rollbackError);
      }
    }

    throw error;
  } finally {
    if (client) client.release();
  }
}

async function findBillsByBusinessDate(date) {
  const sql = `
    SELECT
      bill_id, order_id, room_number, guest_name, pay_way, change_price,
      change_type, stay_type, stay_date, create_time, remarks
    FROM bills
    WHERE stay_date::date = $1::date
    ORDER BY create_time ASC, bill_id ASC
  `;
  const result = await query(sql, [date]);
  return result.rows;
}

/**
 * 判断已完成交接是否已保存来源快照；空明细也会标记，不能误回退为实时账单。
 */
async function hasSourceSnapshot(date) {
  const result = await query(
    `SELECT COALESCE(BOOL_AND(source_snapshot_created), false) AS exists
     FROM handover
     WHERE date = $1::date
       AND payment_type IN (1, 2, 3, 4)`,
    [date]
  );
  return result.rows[0].exists;
}

/**
 * 查询已完成交接的固定来源明细，展示顺序与实时账单参考保持一致。
 */
async function findSourceSnapshots({ date, item, paymentMethod }) {
  const result = await query(
    `SELECT
       bill_id, order_id, room_number, guest_name, change_type,
       source_amount, bill_create_time, remarks
     FROM handover_source_snapshot
     WHERE business_date = $1::date
       AND source_item = $2
       AND payment_method = $3
     ORDER BY bill_create_time ASC NULLS LAST, bill_id ASC NULLS LAST`,
    [date, item, paymentMethod]
  );
  return result.rows;
}

async function findReserveByDate(date) {
  try {
    const sql = `
      SELECT payment_type, handover
      FROM handover
      WHERE date = $1::date
        AND payment_type IN (1,2,3,4)
    `;
    const result = await query(sql, [date]);

    if (result.rows.length === 0) {
      return null;
    }

    const reserveCash = createPaymentBuckets();
    for (const row of result.rows) {
      const method = PAYMENT_TYPE_REVERSE[row.payment_type];
      if (method) {
        const amount = Number(row.handover);
        reserveCash[method] = Number.isFinite(amount)
          ? Number(amount.toFixed(2))
          : 0;
      }
    }
    return reserveCash;
  } catch (error) {
    console.error("获取备用金失败:", error);
    return null;
  }
}

/**
 * 查询当日已保存的现金备用金；记录不存在与金额为 0 必须区分，不能用默认值替代。
 * @param {string} date 营业日期
 * @returns {Promise<object|null>} 备用金设置或空
 */
async function findDailyCashReserve(date) {
  const result = await query(
    `SELECT business_date::text AS business_date, cash_reserve, cash_retained, set_by, updated_at
     FROM handover_daily_settings
     WHERE business_date = $1::date`,
    [date]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    date: row.business_date,
    cashReserve: normalizeAmount(row.cash_reserve),
    cashRetained: normalizeAmount(row.cash_retained),
    setBy: row.set_by,
    updatedAt: row.updated_at
  };
}

/**
 * 判断当天四种支付方式是否全部已保存；完成后备用金必须锁定以保护交接快照。
 * @param {string} date 营业日期
 * @returns {Promise<boolean>} 是否已完成交接
 */
async function isHandoverComplete(date) {
  const result = await query(
    `SELECT COUNT(DISTINCT payment_type) AS payment_count
     FROM handover
     WHERE date = $1::date
       AND payment_type IN (1, 2, 3, 4)`,
    [date]
  );
  return Number(result.rows[0].payment_count) === 4;
}

/**
 * 按营业日期保存现金备用金与留存款；只覆盖当日未完成交接前的设置记录。
 * @param {{date: string, cashReserve: number, cashRetained: number, setBy: string}} input 设置内容
 * @returns {Promise<object>} 已保存的设置
 */
async function saveDailyCashReserve({ date, cashReserve, cashRetained, setBy }) {
  const result = await query(
    `INSERT INTO handover_daily_settings (business_date, cash_reserve, cash_retained, set_by)
     VALUES ($1::date, $2, $3, $4)
     ON CONFLICT (business_date) DO UPDATE SET
       cash_reserve = EXCLUDED.cash_reserve,
       cash_retained = EXCLUDED.cash_retained,
       set_by = EXCLUDED.set_by,
       updated_at = CURRENT_TIMESTAMP
     RETURNING business_date::text AS business_date, cash_reserve, cash_retained, set_by, updated_at`,
    [date, cashReserve, cashRetained, setBy]
  );
  const row = result.rows[0];
  return {
    date: row.business_date,
    cashReserve: normalizeAmount(row.cash_reserve),
    cashRetained: normalizeAmount(row.cash_retained),
    setBy: row.set_by,
    updatedAt: row.updated_at
  };
}

async function findHandoverRowsByDate(date) {
  const sql = `
    SELECT
      payment_type,
      reserve_cash,
      room_income,
      rest_income,
      rent_income,
      total_income,
      room_refund,
      rest_refund,
      retained,
      handover,
      vip_card,
      handover_person,
      takeover_person,
      remarks,
      task_list
    FROM handover
    WHERE date = $1::date
      AND payment_type IN (1, 2, 3, 4)
    ORDER BY payment_type
  `;
  const result = await query(sql, [date]);
  return result.rows;
}

async function findPreviousHandoverSummary(date) {
  const sql = `
    SELECT
      date::text as date,
      COUNT(DISTINCT payment_type) as payment_count,
      array_agg(DISTINCT payment_type ORDER BY payment_type) as payment_types,
      MIN(handover_person) as handover_person,
      MIN(takeover_person) as takeover_person
    FROM handover
    WHERE date = $1::date
      AND payment_type IN (1, 2, 3, 4)
    GROUP BY date
  `;

  const result = await query(sql, [date]);
  const hasRecord = result.rows.length > 0;
  const paymentCount = hasRecord ? Number(result.rows[0].payment_count) : 0;
  const isComplete = hasRecord && paymentCount === 4;
  const handoverAmounts = createPaymentBuckets();

  if (isComplete) {
    const amountSql = `
      SELECT payment_type, handover
      FROM handover
      WHERE date = $1::date
        AND payment_type IN (1, 2, 3, 4)
      ORDER BY payment_type
    `;
    const amountResult = await query(amountSql, [date]);
    amountResult.rows.forEach((row) => {
      const method = PAYMENT_TYPE_REVERSE[row.payment_type];
      if (method) {
        handoverAmounts[method] = normalizeAmount(row.handover);
      }
    });
  }

  return {
    date,
    hasRecord,
    isComplete,
    paymentCount,
    paymentTypes: hasRecord ? result.rows[0].payment_types : [],
    handoverPerson: hasRecord ? result.rows[0].handover_person : null,
    takeoverPerson: hasRecord ? result.rows[0].takeover_person : null,
    handoverAmounts
  };
}

async function findAdminMemoTasks(date) {
  try {
    const sql = `
      SELECT task_list
      FROM handover
      WHERE date = $1::date
        AND payment_type = 1
      LIMIT 1
    `;
    const result = await query(sql, [date]);

    if (result.rows.length === 0) {
      return [];
    }

    const record = result.rows[0];
    if (Array.isArray(record.task_list)) {
      return record.task_list;
    }
    if (typeof record.task_list === "string") {
      try {
        const parsed = JSON.parse(record.task_list);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  } catch (error) {
    console.error("获取管理员备忘录失败:", error);
    return [];
  }
}

async function getOverviewSpecialStats(date) {
  const targetDate = formatDate(date || new Date());

  const roomCountSql = `
    WITH pending_orders AS (
      SELECT order_id, stay_type
      FROM orders
      WHERE status = 'pending'
        AND check_in_date::date = $1::date
    ),
    active_orders AS (
      SELECT
        o.order_id,
        o.stay_type,
        MIN(b.stay_date::date) AS first_stay_date
      FROM orders o
      LEFT JOIN bills b ON b.order_id = o.order_id
      WHERE o.status IN ('checked-in', 'checked-out')
      GROUP BY o.order_id, o.stay_type
    )
    SELECT
      COALESCE((SELECT COUNT(*) FROM pending_orders WHERE stay_type = '客房'), 0) +
      COALESCE((SELECT COUNT(*) FROM active_orders WHERE stay_type = '客房' AND first_stay_date = $1::date), 0) AS open_count,
      COALESCE((SELECT COUNT(*) FROM pending_orders WHERE stay_type = '休息房'), 0) +
      COALESCE((SELECT COUNT(*) FROM active_orders WHERE stay_type = '休息房' AND first_stay_date = $1::date), 0) AS rest_count
  `;

  const reviewSql = `
    SELECT
      COUNT(*) AS invited,
      COUNT(*) FILTER (WHERE positive_review = true) AS positive
    FROM review_invitations
    WHERE invite_time::date = $1::date
  `;

  try {
    const roomRes = await query(roomCountSql, [targetDate]);
    const reviewRes = await query(reviewSql, [targetDate]);

    return {
      openCount: parseInt(roomRes.rows[0]?.open_count) || 0,
      restCount: parseInt(roomRes.rows[0]?.rest_count) || 0,
      invited: parseInt(reviewRes.rows[0]?.invited) || 0,
      positive: parseInt(reviewRes.rows[0]?.positive) || 0
    };
  } catch (error) {
    console.error("获取交接班特殊统计失败:", error);
    return { openCount: 0, restCount: 0, invited: 0, positive: 0 };
  }
}

module.exports = {
  listCompletedHandoverRecords,
  saveCompletedHandover,
  getSpecialStats,
  findBillsByBusinessDate,
  findSourceSnapshots,
  findDailyCashReserve,
  findHandoverRowsByDate,
  findReserveByDate,
  isHandoverComplete,
  hasSourceSnapshot,
  findPreviousHandoverSummary,
  findAdminMemoTasks,
  getOverviewSpecialStats,
  saveDailyCashReserve
};
