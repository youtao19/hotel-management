"use strict";

const { query } = require("../../database/postgreDB/pg");

async function inviteReview(orderId) {
  await query(`
    INSERT INTO review_invitations (order_id, invited, invite_time)
    VALUES ($1, TRUE, NOW())
    ON CONFLICT (order_id)
    DO UPDATE SET invited = EXCLUDED.invited, invite_time = EXCLUDED.invite_time
  `, [orderId]);
}

async function updateReviewStatus(orderId, positiveReview) {
  await query(`
    INSERT INTO review_invitations (order_id, invited, positive_review, update_time)
    VALUES ($1, TRUE, $2, NOW())
    ON CONFLICT (order_id)
    DO UPDATE SET positive_review = EXCLUDED.positive_review, update_time = EXCLUDED.update_time
  `, [orderId, positiveReview]);
}

async function getOrderWithReviewInfo(orderId) {
  const result = await query(`
    SELECT o.*,
           ri.invited AS review_invited,
           ri.positive_review,
           ri.invite_time AS review_invite_time,
           ri.update_time AS review_update_time
    FROM orders o
    LEFT JOIN review_invitations ri ON ri.order_id = o.order_id
    WHERE o.order_id = $1
  `, [orderId]);
  return result.rows[0];
}

async function getReviewByOrderId(orderId) {
  const result = await query(`
    SELECT ri.*
    FROM review_invitations ri
    WHERE ri.order_id = $1
  `, [orderId]);
  return result.rows[0] || null;
}

async function getPendingReviewInvitations() {
  const result = await query(`
    SELECT o.*,
           COALESCE(ri.invited, FALSE) AS review_invited,
           ri.positive_review,
           ri.invite_time AS review_invite_time
    FROM orders o
    LEFT JOIN review_invitations ri ON ri.order_id = o.order_id
    WHERE o.create_time >= (CURRENT_DATE - INTERVAL '1 day')
      AND o.create_time < (CURRENT_DATE + INTERVAL '1 day')
      AND COALESCE(ri.invited, FALSE) = FALSE
    ORDER BY o.create_time DESC
  `);
  return result.rows;
}

async function getPendingReviewUpdates() {
  const result = await query(`
    SELECT o.*,
           ri.invited AS review_invited,
           ri.positive_review,
           ri.invite_time AS review_invite_time,
           ri.update_time AS review_update_time
    FROM orders o
    JOIN review_invitations ri ON ri.order_id = o.order_id
    WHERE ri.invited = TRUE
      AND ri.positive_review IS NULL
    ORDER BY ri.invite_time DESC
  `);
  return result.rows;
}

function buildReviewFilters(options = {}) {
  const whereConditions = ["ri.order_id IS NOT NULL"];
  const params = [];
  let paramIndex = 1;

  if (options.startDate) {
    whereConditions.push(`o.check_out_date >= $${paramIndex}`);
    params.push(options.startDate);
    paramIndex++;
  }

  if (options.endDate) {
    whereConditions.push(`o.check_out_date <= $${paramIndex}`);
    params.push(options.endDate);
    paramIndex++;
  }

  if (options.status === "invited") {
    whereConditions.push("ri.invited = TRUE");
  } else if (options.status === "positive") {
    whereConditions.push("ri.positive_review = TRUE");
  } else if (options.status === "negative") {
    whereConditions.push("ri.positive_review = FALSE");
  }

  return { whereConditions, params };
}

async function getAllReviewOrders(options = {}) {
  const { whereConditions, params } = buildReviewFilters(options);
  const result = await query(`
    SELECT o.*,
           ri.invited AS review_invited,
           ri.positive_review,
           ri.invite_time AS review_invite_time,
           ri.update_time AS review_update_time
    FROM orders o
    JOIN review_invitations ri ON ri.order_id = o.order_id
    WHERE ${whereConditions.join(" AND ")}
    ORDER BY o.check_out_date DESC, ri.invite_time DESC
  `, params);
  return result.rows;
}

async function getReviewStatistics(options = {}) {
  const { whereConditions, params } = buildReviewFilters(options);
  const result = await query(`
    SELECT
        COUNT(*) as total_invitations,
        COUNT(CASE WHEN ri.positive_review = TRUE THEN 1 END) as positive_reviews,
        COUNT(CASE WHEN ri.positive_review = FALSE THEN 1 END) as negative_reviews,
        COUNT(CASE WHEN ri.positive_review IS NULL THEN 1 END) as pending_reviews,
        ROUND(
            COUNT(CASE WHEN ri.positive_review = TRUE THEN 1 END) * 100.0 /
            NULLIF(COUNT(CASE WHEN ri.positive_review IS NOT NULL THEN 1 END), 0),
            2
        ) as positive_rate
    FROM orders o
    JOIN review_invitations ri ON ri.order_id = o.order_id
    WHERE ${whereConditions.join(" AND ")}
  `, params);
  return result.rows[0];
}

module.exports = {
  getAllReviewOrders,
  getOrderWithReviewInfo,
  getPendingReviewInvitations,
  getPendingReviewUpdates,
  getReviewByOrderId,
  getReviewStatistics,
  inviteReview,
  updateReviewStatus
};
