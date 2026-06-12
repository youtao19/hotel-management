"use strict";

const { getClient, query } = require("../../database/postgreDB/pg");
const { PAYMENT_METHODS } = require("./shiftHandover.validator");

const PAYMENT_TYPE_MAPPING = { "现金": 1, "微信": 2, "微邮付": 3, "其他": 4 };

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

module.exports = {
  listCompletedHandoverRecords,
  saveCompletedHandover,
  getSpecialStats
};
