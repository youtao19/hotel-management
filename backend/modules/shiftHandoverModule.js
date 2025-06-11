const { query } = require('../database/postgreDB/pg');

/**
 * 获取指定日期范围内的收款明细
 * @param {string} type - 房间类型 (hotel/rest)
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @returns {Promise<Array>} 收款明细列表
 */
async function getReceiptDetails(type, startDate, endDate) {
  const sql = `
    SELECT
      o.order_number,
      o.room_number,
      o.room_price as room_fee,
      o.deposit,
      o.payment_method,
      (o.room_price + COALESCE(o.deposit, 0)) as total_amount,
      o.check_in_date,
      o.check_out_date
    FROM orders o
    JOIN rooms r ON o.room_number = r.room_number
    WHERE r.type_code = $1
    AND o.created_at BETWEEN $2 AND $3
    ORDER BY o.created_at DESC;
  `;

  try {
    const result = await query(sql, [
      type === 'hotel' ? 'standard' : 'rest',
      startDate,
      endDate
    ]);
    return result.rows;
  } catch (error) {
    console.error('获取收款明细失败:', error);
    throw error;
  }
}

/**
 * 获取指定日期的统计数据
 * @param {string} date - 统计日期
 * @returns {Promise<Object>} 统计数据
 */
async function getStatistics(date) {
  // 获取当天的订单统计
  const sql = `
    SELECT
      r.type_code,
      SUM(o.room_price) as income,
      SUM(o.deposit) as deposit,
      COUNT(*) as count
    FROM orders o
    JOIN rooms r ON o.room_number = r.room_number
    WHERE DATE(o.created_at) = $1
    GROUP BY r.type_code;
  `;

  try {
    const result = await query(sql, [date]);

    // 初始化统计数据
    const statistics = {
      reserveCash: 1000, // 默认备用金
      hotelIncome: 0,
      restIncome: 0,
      carRentalIncome: 0,
      totalIncome: 0,
      hotelDeposit: 0,
      restDeposit: 0,
      retainedAmount: 0,
      handoverAmount: 0,
      goodReviews: 0,
      vipCards: 0
    };

    // 处理查询结果
    result.rows.forEach(row => {
      if (row.type_code === 'standard' || row.type_code === 'deluxe' || row.type_code === 'suite') {
        statistics.hotelIncome += Number(row.income || 0);
        statistics.hotelDeposit += Number(row.deposit || 0);
      } else if (row.type_code === 'rest') {
        statistics.restIncome += Number(row.income || 0);
        statistics.restDeposit += Number(row.deposit || 0);
      }
    });

    // 计算总收入和交接款
    statistics.totalIncome = statistics.hotelIncome + statistics.restIncome + statistics.carRentalIncome;
    statistics.handoverAmount = statistics.totalIncome - statistics.hotelDeposit - statistics.restDeposit;

    return statistics;
  } catch (error) {
    console.error('获取统计数据失败:', error);
    throw error;
  }
}

/**
 * 保存交接班记录
 * @param {Object} handoverData - 交接班数据
 * @returns {Promise<Object>} 保存的交接班记录
 */
async function saveHandover(handoverData) {
  const { type, details, statistics, remarks, date } = handoverData;

  const sql = `
    INSERT INTO shift_handover (
      type,
      details,
      statistics,
      remarks,
      shift_date
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;

  try {
    const result = await query(sql, [
      type,
      JSON.stringify(details),
      JSON.stringify(statistics),
      remarks,
      date
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('保存交接班记录失败:', error);
    throw error;
  }
}

/**
 * 获取历史交接班记录
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @returns {Promise<Array>} 交接班记录列表
 */
async function getHandoverHistory(startDate, endDate) {
  const sql = `
    SELECT
      h.*
    FROM shift_handover h
    WHERE h.shift_date BETWEEN $1 AND $2
    ORDER BY h.created_at DESC;
  `;

  try {
    const result = await query(sql, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('获取交接班历史记录失败:', error);
    throw error;
  }
}

module.exports = {
  getReceiptDetails,
  getStatistics,
  saveHandover,
  getHandoverHistory
};
