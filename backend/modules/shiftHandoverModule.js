const { query } = require('../database/postgreDB/pg');

/**
 * 获取指定日期范围内的收款明细
 * @param {string} type - 房间类型 (hotel/rest)
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @returns {Promise<Array>} 收款明细列表
 */
async function getReceiptDetails(type, startDate, endDate) {
  // 根据类型确定分类条件 - 基于订单业务属性而非房间类型
  let typeCondition = '';
  if (type === 'hotel') {
    // 客房：跨日期的订单或房价高于150的订单
    typeCondition = `(
      DATE(o.check_in_date) != DATE(o.check_out_date)
      OR o.room_price > 150
    )`;
  } else if (type === 'rest') {
    // 休息房：同日期且房价低于等于150的订单
    typeCondition = `(
      DATE(o.check_in_date) = DATE(o.check_out_date)
      AND o.room_price <= 150
    )`;
  } else {
    typeCondition = "1=1"; // 显示所有类型
  }

  const sql = `
    SELECT
      o.order_id as id,
      o.order_id as order_number,
      o.room_number,
      COALESCE(o.room_price, 0) as room_fee,
      COALESCE(o.deposit, 0) as deposit,
      COALESCE(o.payment_method, '现金') as payment_method,
      (COALESCE(o.room_price, 0) + COALESCE(o.deposit, 0)) as total_amount,
      o.check_in_date,
      o.check_out_date,
      o.create_time as created_at,
      r.type_code,
      CASE
        WHEN (DATE(o.check_in_date) != DATE(o.check_out_date)
              OR o.room_price > 150) THEN 'hotel'
        ELSE 'rest'
      END as business_type
    FROM orders o
    JOIN rooms r ON o.room_number = r.room_number
    WHERE ${typeCondition}
    AND DATE(o.create_time) BETWEEN $1 AND $2
    AND o.status IN ('checked_in', 'checked_out', 'completed', 'checked-in', 'checked-out')
    ORDER BY o.create_time DESC;
  `;

  try {
    const result = await query(sql, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('获取收款明细失败:', error);
    throw error;
  }
}

/**
 * 获取指定日期范围的统计数据
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期（可选，默认与开始日期相同）
 * @returns {Promise<Object>} 统计数据
 */
async function getStatistics(startDate, endDate = null) {
  // 如果没有提供结束日期，使用开始日期（单天查询）
  const finalEndDate = endDate || startDate;

  // 获取指定日期范围的订单统计 - 基于业务类型
  const orderStatsSql = `
    SELECT
      CASE
        WHEN (DATE(o.check_in_date) != DATE(o.check_out_date)
              OR o.room_price > 150) THEN 'hotel'
        ELSE 'rest'
      END as business_type,
      SUM(COALESCE(o.room_price, 0)) as income,
      SUM(COALESCE(o.deposit, 0)) as deposit,
      COUNT(*) as count,
      o.payment_method
    FROM orders o
    WHERE DATE(o.create_time) BETWEEN $1 AND $2
    AND o.status IN ('checked_in', 'checked_out', 'completed', 'checked-in', 'checked-out')
    GROUP BY business_type, o.payment_method;
  `;

  // 获取指定日期范围的房间统计 - 基于业务类型
  const roomStatsSql = `
    SELECT
      CASE
        WHEN (DATE(o.check_in_date) != DATE(o.check_out_date)
              OR o.room_price > 150) THEN 'hotel'
        ELSE 'rest'
      END as business_type,
      COUNT(*) as room_count
    FROM orders o
    WHERE DATE(o.create_time) BETWEEN $1 AND $2
    AND o.status IN ('checked_in', 'checked_out', 'completed', 'checked-in', 'checked-out')
    GROUP BY business_type;
  `;

  try {
    const [orderStatsResult, roomStatsResult] = await Promise.all([
      query(orderStatsSql, [startDate, finalEndDate]),
      query(roomStatsSql, [startDate, finalEndDate])
    ]);

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
      vipCards: 0,
      totalRooms: 0,
      restRooms: 0,
      paymentBreakdown: {
        '现金': 0,
        '微信': 0,
        '支付宝': 0,
        '银行卡': 0,
        '其他': 0
      }
    };

    // 处理订单统计结果 - 基于业务类型
    orderStatsResult.rows.forEach(row => {
      const income = Number(row.income || 0);
      const deposit = Number(row.deposit || 0);
      const paymentMethod = row.payment_method || '现金';

      // 按业务类型分类收入
      if (row.business_type === 'hotel') {
        statistics.hotelIncome += income;
        statistics.hotelDeposit += deposit;
      } else if (row.business_type === 'rest') {
        statistics.restIncome += income;
        statistics.restDeposit += deposit;
      }

      // 按支付方式分类
      if (statistics.paymentBreakdown.hasOwnProperty(paymentMethod)) {
        statistics.paymentBreakdown[paymentMethod] += income + deposit;
      } else {
        statistics.paymentBreakdown['其他'] += income + deposit;
      }
    });

    // 处理房间统计结果 - 基于业务类型
    roomStatsResult.rows.forEach(row => {
      const count = Number(row.room_count || 0);
      if (row.business_type === 'hotel') {
        statistics.totalRooms += count;
      } else if (row.business_type === 'rest') {
        statistics.restRooms += count;
      }
    });

    // 计算总收入
    statistics.totalIncome = statistics.hotelIncome + statistics.restIncome + statistics.carRentalIncome;

    // 计算交接款金额
    statistics.handoverAmount = statistics.totalIncome + statistics.reserveCash -
                               statistics.hotelDeposit - statistics.restDeposit - statistics.retainedAmount;

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
  // 验证必填字段
  if (!handoverData || typeof handoverData !== 'object') {
    throw new Error('交接班数据不能为空');
  }

  const {
    type = 'hotel',
    details = [],
    statistics = {},
    remarks = '',
    cashier_name,
    shift_time,
    shift_date = new Date().toISOString().split('T')[0]
  } = handoverData;

  // 验证必填字段
  if (!cashier_name || cashier_name.trim() === '' || cashier_name === '未知') {
    throw new Error('收银员姓名不能为空');
  }

  if (!shift_time || shift_time.trim() === '') {
    throw new Error('交班时间不能为空');
  }

  if (!type || !['hotel', 'rest'].includes(type)) {
    throw new Error('交接班类型必须是 hotel 或 rest');
  }

  const sql = `
    INSERT INTO shift_handover (
      type,
      details,
      statistics,
      remarks,
      cashier_name,
      shift_time,
      shift_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  try {
    const result = await query(sql, [
      type,
      JSON.stringify(details || []),
      JSON.stringify(statistics || {}),
      remarks || '',
      cashier_name.trim(),
      shift_time.trim(),
      shift_date
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
      h.*,
      h.statistics->>'totalIncome' as total_income,
      h.statistics->>'handoverAmount' as handover_amount
    FROM shift_handover h
    WHERE h.shift_date BETWEEN $1 AND $2
    ORDER BY h.shift_date DESC, h.created_at DESC;
  `;

  try {
    const result = await query(sql, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('获取交接班历史记录失败:', error);
    throw error;
  }
}

/**
 * 导出交接班数据为Excel格式
 * @param {Object} handoverData - 交接班数据
 * @returns {Promise<Buffer>} Excel文件缓冲区
 */
async function exportHandoverToExcel(handoverData) {
  // 这里需要安装 xlsx 库
  // npm install xlsx
  try {
    const XLSX = require('xlsx');

    const { type, details, statistics, date } = handoverData;

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 创建明细工作表
    const detailsData = details.map((item, index) => ({
      '序号': index + 1,
      '房号': item.room_number,
      '单号': item.order_number,
      '房费': item.room_fee,
      '押金': item.deposit,
      '支付方式': item.payment_method,
      '总金额': item.total_amount,
      '开房时间': item.check_in_date,
      '退房时间': item.check_out_date
    }));

    const detailsWorksheet = XLSX.utils.json_to_sheet(detailsData);
    XLSX.utils.book_append_sheet(workbook, detailsWorksheet, '收款明细');

    // 创建统计工作表
    const statisticsData = [
      { '项目': '备用金', '金额': statistics.reserveCash },
      { '项目': '客房收入', '金额': statistics.hotelIncome },
      { '项目': '休息房收入', '金额': statistics.restIncome },
      { '项目': '租车收入', '金额': statistics.carRentalIncome },
      { '项目': '合计', '金额': statistics.totalIncome },
      { '项目': '客房退押', '金额': statistics.hotelDeposit },
      { '项目': '休息退押', '金额': statistics.restDeposit },
      { '项目': '留存款', '金额': statistics.retainedAmount },
      { '项目': '交接款', '金额': statistics.handoverAmount },
      { '项目': '好评数', '金额': statistics.goodReviews },
      { '项目': '大美卡', '金额': statistics.vipCards },
      { '项目': '开房数', '金额': statistics.totalRooms },
      { '项目': '休息房数', '金额': statistics.restRooms }
    ];

    const statisticsWorksheet = XLSX.utils.json_to_sheet(statisticsData);
    XLSX.utils.book_append_sheet(workbook, statisticsWorksheet, '统计信息');

    // 生成Excel文件
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;

  } catch (error) {
    console.error('导出Excel失败:', error);
    throw error;
  }
}

module.exports = {
  getReceiptDetails,
  getStatistics,
  saveHandover,
  getHandoverHistory,
  exportHandoverToExcel
};
