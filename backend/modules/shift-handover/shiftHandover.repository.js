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

async function saveCompletedHandover({ date, operatorName, receivePerson, vipCard, notes, paymentData }) {
  let client;

  try {
    client = await getClient();
    await client.query("BEGIN");

    const insertSQL = `
      INSERT INTO handover (
        date, handover_person, takeover_person, vip_card, payment_type,
        reserve_cash, room_income, rest_income, rent_income, total_income,
        room_refund, rest_refund, retained, handover, task_list, remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
    SELECT bill_id, order_id, pay_way, change_price, change_type, stay_type, stay_date
    FROM bills
    WHERE stay_date::date = $1::date
    ORDER BY bill_id ASC
  `;
  const result = await query(sql, [date]);
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
  findHandoverRowsByDate,
  findReserveByDate,
  findPreviousHandoverSummary,
  findAdminMemoTasks,
  getOverviewSpecialStats
};
