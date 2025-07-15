const { query } = require('../database/postgreDB/pg');

/**
 * 标准化支付方式名称 - 将各种可能的值统一转换为标准的中文名称
 * @param {string} paymentMethod - 原始支付方式值
 * @returns {string} 标准化的中文支付方式名称
 */
function normalizePaymentMethod(paymentMethod) {
  if (!paymentMethod) return '现金';

  // 转换为小写进行比较
  const method = paymentMethod.toString().toLowerCase().trim();

  // 支付方式映射表
  const methodMap = {
    // 现金相关
    'cash': '现金',
    '现金': '现金',
    'xian_jin': '现金',

    // 微信相关
    'wechat': '微信',
    'weixin': '微信',
    '微信': '微信',
    'wx': '微信',

    // 支付宝相关
    'alipay': '支付宝',
    'zhifubao': '支付宝',
    '支付宝': '支付宝',
    'weiyoufu': '支付宝', // 微邮付归类为支付宝
    '微邮付': '支付宝',

    // 银行卡相关
    'card': '银行卡',
    'bank_card': '银行卡',
    'credit_card': '银行卡',
    'debit_card': '银行卡',
    '银行卡': '银行卡',
    '信用卡': '银行卡',
    '借记卡': '银行卡',

    // 平台相关
    'platform': '其他',
    '平台': '其他'
  };

  // 查找匹配的支付方式
  if (methodMap[method]) {
    return methodMap[method];
  }

  // 如果没有找到匹配项，检查是否包含关键词
  if (method.includes('现金') || method.includes('cash')) {
    return '现金';
  }
  if (method.includes('微信') || method.includes('wechat') || method.includes('weixin')) {
    return '微信';
  }
  if (method.includes('支付宝') || method.includes('alipay') || method.includes('微邮付')) {
    return '支付宝';
  }
  if (method.includes('银行') || method.includes('卡') || method.includes('card')) {
    return '银行卡';
  }

  // 默认归类为其他
  return '其他';
}

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
      o.check_in_date::date != o.check_out_date::date
      OR o.room_price > 150
    )`;
  } else if (type === 'rest') {
    // 休息房：同日期且房价低于等于150的订单
    typeCondition = `(
      o.check_in_date::date = o.check_out_date::date
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
      o.guest_name,
      COALESCE(b.room_fee, o.room_price, 0) as room_fee,
      COALESCE(b.deposit, o.deposit, 0) as deposit,
      COALESCE(b.pay_way, o.payment_method, '现金') as payment_method,
      COALESCE(b.total_income, (COALESCE(b.room_fee, o.room_price, 0) + COALESCE(b.deposit, o.deposit, 0))) as total_amount,
      o.check_in_date,
      o.check_out_date,
      o.create_time as created_at,
      r.type_code,
      CASE
        WHEN (o.check_in_date::date != o.check_out_date::date
              OR COALESCE(b.room_fee, o.room_price, 0) > 150) THEN 'hotel'
        ELSE 'rest'
      END as business_type
    FROM orders o
    JOIN rooms r ON o.room_number = r.room_number
    LEFT JOIN bills b ON o.order_id = b.order_id
    WHERE ${typeCondition}
    AND o.check_in_date::date BETWEEN $1::date AND $2::date
    AND o.status IN ('checked-in', 'checked-out', 'pending')
    ORDER BY o.check_in_date DESC;
  `;

  try {
    const result = await query(sql, [startDate, endDate]);

    // 标准化支付方式
    const processedRows = result.rows.map(row => ({
      ...row,
      payment_method: normalizePaymentMethod(row.payment_method)
    }));

    return processedRows;
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
        WHEN (o.check_in_date::date != o.check_out_date::date
              OR COALESCE(b.room_fee, o.room_price, 0) > 150) THEN 'hotel'
        ELSE 'rest'
      END as business_type,
      SUM(COALESCE(b.room_fee, o.room_price, 0)) as room_fee_income,
      SUM(COALESCE(b.deposit, o.deposit, 0)) as deposit_income,
      SUM(COALESCE(b.total_income, (COALESCE(b.room_fee, o.room_price, 0) + COALESCE(b.deposit, o.deposit, 0)))) as total_income,
      SUM(CASE WHEN b.refund_deposit = true THEN COALESCE(b.deposit, o.deposit, 0) ELSE 0 END) as refunded_deposit,
      COUNT(*) as count,
      COALESCE(b.pay_way, o.payment_method, '现金') as payment_method
    FROM orders o
    LEFT JOIN bills b ON o.order_id = b.order_id
    WHERE o.check_in_date::date BETWEEN $1::date AND $2::date
    AND o.status IN ('checked-in', 'checked-out', 'pending')
    GROUP BY business_type, COALESCE(b.pay_way, o.payment_method, '现金');
  `;

  // 获取指定日期范围的房间统计 - 基于业务类型
  const roomStatsSql = `
    SELECT
      CASE
        WHEN (o.check_in_date::date != o.check_out_date::date
              OR COALESCE(b.room_fee, o.room_price, 0) > 150) THEN 'hotel'
        ELSE 'rest'
      END as business_type,
      COUNT(*) as room_count
    FROM orders o
    LEFT JOIN bills b ON o.order_id = b.order_id
    WHERE o.check_in_date::date BETWEEN $1::date AND $2::date
    AND o.status IN ('checked-in', 'checked-out', 'pending')
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
      },
      // 新增：按支付方式和业务类型的详细分解
      paymentDetails: {
        '现金': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
        '微信': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
        '支付宝': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
        '银行卡': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
        '其他': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 }
      }
    };

    // 处理订单统计结果 - 基于业务类型和支付方式
    orderStatsResult.rows.forEach(row => {
      const income = Number(row.total_income || 0);
      const deposit = Number(row.refunded_deposit || 0);
      const rawPaymentMethod = row.payment_method || '现金';
      const paymentMethod = normalizePaymentMethod(rawPaymentMethod); // 标准化支付方式
      const businessType = row.business_type || 'hotel';

      console.log(`处理订单统计: 原始支付方式=${rawPaymentMethod}, 标准化后=${paymentMethod}, 业务类型=${businessType}, 总收入=${income}, 退押金=${deposit}`);

      // 按业务类型分类收入和退押金
      if (businessType === 'hotel') {
        statistics.hotelIncome += income;  // 现在income是总收入（房费+押金）
        statistics.hotelDeposit += deposit; // 现在deposit是退还的押金
      } else if (businessType === 'rest') {
        statistics.restIncome += income;   // 现在income是总收入（房费+押金）
        statistics.restDeposit += deposit; // 现在deposit是退还的押金
      }

      // 按支付方式分类总收入（不包括退押金）
      if (statistics.paymentBreakdown.hasOwnProperty(paymentMethod)) {
        statistics.paymentBreakdown[paymentMethod] += income;
      } else {
        statistics.paymentBreakdown['其他'] += income;
      }

      // 按支付方式和业务类型的详细分解
      let targetPaymentMethod = paymentMethod;
      if (!statistics.paymentDetails.hasOwnProperty(paymentMethod)) {
        targetPaymentMethod = '其他';
      }

      if (businessType === 'hotel') {
        statistics.paymentDetails[targetPaymentMethod].hotelIncome += income;   // 总收入（房费+押金）
        statistics.paymentDetails[targetPaymentMethod].hotelDeposit += deposit; // 退还的押金
      } else if (businessType === 'rest') {
        statistics.paymentDetails[targetPaymentMethod].restIncome += income;    // 总收入（房费+押金）
        statistics.paymentDetails[targetPaymentMethod].restDeposit += deposit;  // 退还的押金
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

  // 兼容新旧格式
  const {
    // 新格式字段
    date,
    shift,
    handoverPerson,
    receivePerson,
    cashierName,
    notes,
    paymentData,
    totalSummary,
    handoverAmount,
    specialStats,
    taskList,
    htmlSnapshot,

    // 旧格式字段 (向后兼容)
    type = 'hotel',
    details = [],
    statistics = {},
    remarks = '',
    cashier_name,
    shift_time,
    shift_date = new Date().toISOString().split('T')[0]
  } = handoverData;

  // 确定最终字段值 (新格式优先)
  const finalCashierName = cashierName || cashier_name;
  const finalShiftTime = shift_time || new Date().toTimeString().slice(0, 5);
  const finalShiftDate = date || shift_date;
  const finalRemarks = notes || remarks;
  const finalHandoverPerson = handoverPerson || '';
  const finalReceivePerson = receivePerson || '';

  // 验证必填字段
  if (!finalCashierName || finalCashierName.trim() === '' || finalCashierName === '未知') {
    throw new Error('收银员姓名不能为空');
  }

  // 构造完整的交接班数据
  const fullHandoverData = {
    // 基本信息
    date: finalShiftDate,
    shift: shift || '白班',
    handoverPerson: finalHandoverPerson,
    receivePerson: finalReceivePerson,
    cashierName: finalCashierName,
    notes: finalRemarks,

    // 支付数据
    paymentData: paymentData || {},
    totalSummary: totalSummary || {},
    handoverAmount: handoverAmount || 0,
    specialStats: specialStats || {},
    taskList: taskList || [],

    // 兼容旧格式
    type,
    details,
    statistics
  };

  const sql = `
    INSERT INTO shift_handover (
      type,
      details,
      statistics,
      remarks,
      cashier_name,
      shift_time,
      shift_date,
      html_snapshot,
      handover_person,
      receive_person
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;

  try {
    const result = await query(sql, [
      type,
      JSON.stringify(fullHandoverData),
      JSON.stringify(totalSummary || statistics || {}),
      finalRemarks,
      finalCashierName.trim(),
      finalShiftTime,
      finalShiftDate,
      htmlSnapshot || null, // HTML快照
      finalHandoverPerson,
      finalReceivePerson
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
async function getHandoverHistory(startDate, endDate, page = 1, limit = 10, cashierName = '') {
  let sql = `
    SELECT
      h.*,
      h.statistics->>'totalIncome' as total_income,
      h.statistics->>'handoverAmount' as handover_amount
    FROM shift_handover h
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  // 添加日期筛选
  if (startDate) {
    sql += ` AND h.shift_date >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    sql += ` AND h.shift_date <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  // 添加收银员筛选
  if (cashierName) {
    sql += ` AND h.cashier_name ILIKE $${paramIndex}`;
    params.push(`%${cashierName}%`);
    paramIndex++;
  }

  sql += ` ORDER BY h.id DESC`;

  // 添加分页
  const offset = (page - 1) * limit;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const result = await query(sql, params);

    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total
      FROM shift_handover h
      WHERE 1=1
    `;

    const countParams = [];
    let countParamIndex = 1;

    if (startDate) {
      countSql += ` AND h.shift_date >= $${countParamIndex}`;
      countParams.push(startDate);
      countParamIndex++;
    }

    if (endDate) {
      countSql += ` AND h.shift_date <= $${countParamIndex}`;
      countParams.push(endDate);
      countParamIndex++;
    }

    if (cashierName) {
      countSql += ` AND h.cashier_name ILIKE $${countParamIndex}`;
      countParams.push(`%${cashierName}%`);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].total);

    // 处理返回数据，确保details字段正确解析
    const processedRows = result.rows.map(row => {
      try {
        // 解析details字段中的完整数据
        const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;

        return {
          ...row,
          details: details,
          // 兼容性处理：如果details中包含新格式数据，提取到顶层
          paymentData: details.paymentData || null,
          taskList: details.taskList || null,
          specialStats: details.specialStats || null,
          // 确保html_snapshot字段正确返回
          html_snapshot: row.html_snapshot
        };
      } catch (parseError) {
        console.error('解析交接班详情数据失败:', parseError);
        return row;
      }
    });

    return {
      data: processedRows,
      total: total,
      page: page,
      limit: limit
    };
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
      '客户姓名': item.guest_name || '未知客户',
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

/**
 * 导出新版交接班表格为Excel格式
 * @param {Object} handoverData - 交接班数据
 * @returns {Promise<Buffer>} Excel文件缓冲区
 */
async function exportNewHandoverToExcel(handoverData) {
  try {
    const XLSX = require('xlsx');

    const {
      date,
      shift,
      handoverPerson,
      receivePerson,
      cashierName,
      notes,
      paymentData,
      totalSummary,
      handoverAmount,
      specialStats
    } = handoverData;

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 创建交接班表格数据
    const sheetData = [
      // 标题行
      ['交接班记录'],
      [`日期: ${date}`, `班次: ${shift}`, `交班人: ${handoverPerson}`, `接班人: ${receivePerson}`],
      [],
      // 表头
      ['支付方式', '各用金', '客房收入1', '休息房收入2', '租车收入3', '合计', '客房退押', '休息退押', '留存款', '备注'],
      // 现金行
      [
        '现金',
        paymentData.cash.reserveCash || 0,
        paymentData.cash.hotelIncome || 0,
        paymentData.cash.restIncome || 0,
        0, // 租车收入
        paymentData.cash.total || 0,
        paymentData.cash.hotelDeposit || 0,
        paymentData.cash.restDeposit || 0,
        paymentData.cash.retainedAmount || 0,
        notes || ''
      ],
      // 微信行
      [
        '微信',
        paymentData.wechat.reserveCash || 0,
        paymentData.wechat.hotelIncome || 0,
        paymentData.wechat.restIncome || 0,
        0,
        paymentData.wechat.total || 0,
        paymentData.wechat.hotelDeposit || 0,
        paymentData.wechat.restDeposit || 0,
        paymentData.wechat.retainedAmount || 0,
        ''
      ],
      // 数码付行
      [
        '微邮付',
        paymentData.digital.reserveCash || 0,
        paymentData.digital.hotelIncome || 0,
        paymentData.digital.restIncome || 0,
        0,
        paymentData.digital.total || 0,
        paymentData.digital.hotelDeposit || 0,
        paymentData.digital.restDeposit || 0,
        paymentData.digital.retainedAmount || 0,
        ''
      ],
      // 合计行
      [
        '合计',
        (paymentData.cash.reserveCash || 0) + (paymentData.wechat.reserveCash || 0) + (paymentData.digital.reserveCash || 0),
        (paymentData.cash.hotelIncome || 0) + (paymentData.wechat.hotelIncome || 0) + (paymentData.digital.hotelIncome || 0),
        (paymentData.cash.restIncome || 0) + (paymentData.wechat.restIncome || 0) + (paymentData.digital.restIncome || 0),
        0,
        (paymentData.cash.total || 0) + (paymentData.wechat.total || 0) + (paymentData.digital.total || 0),
        (paymentData.cash.hotelDeposit || 0) + (paymentData.wechat.hotelDeposit || 0) + (paymentData.digital.hotelDeposit || 0),
        (paymentData.cash.restDeposit || 0) + (paymentData.wechat.restDeposit || 0) + (paymentData.digital.restDeposit || 0),
        (paymentData.cash.retainedAmount || 0) + (paymentData.wechat.retainedAmount || 0) + (paymentData.digital.retainedAmount || 0),
        `交接款: ${handoverAmount || 0}`
      ],
      [],
      // 特殊统计
      ['特殊统计'],
      ['项目', '数量', '收银员', cashierName || ''],
      ['好评', '遗1得1', '', ''],
      ['大美卡', specialStats?.vipCards || 0, '', ''],
      ['开房数', specialStats?.totalRooms || 0, '', ''],
      ['休息房数', specialStats?.restRooms || 0, '', '']
    ];

    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // 设置列宽
    worksheet['!cols'] = [
      { wch: 10 }, // 支付方式
      { wch: 10 }, // 各用金
      { wch: 12 }, // 客房收入1
      { wch: 12 }, // 休息房收入2
      { wch: 12 }, // 租车收入3
      { wch: 10 }, // 合计
      { wch: 10 }, // 客房退押
      { wch: 10 }, // 休息退押
      { wch: 10 }, // 留存款
      { wch: 30 }  // 备注
    ];

    // 合并标题单元格
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // 标题行合并
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, // 日期
      { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } }, // 班次
      { s: { r: 4, c: 9 }, e: { r: 7, c: 9 } }  // 备注列合并
    ];

    // 添加到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '交接班记录');

    // 生成Excel文件
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;

  } catch (error) {
    console.error('导出新版Excel失败:', error);
    throw error;
  }
}

/**
 * 获取前一天的交接班记录（用于获取备用金）
 * @param {string} currentDate - 当前日期
 * @returns {Promise<Object|null>} 前一天的交接班记录
 */
async function getPreviousHandoverData(currentDate) {
  // 计算前一天的日期
  const current = new Date(currentDate);
  const previous = new Date(current);
  previous.setDate(current.getDate() - 1);
  const previousDateStr = previous.toISOString().split('T')[0];

  console.log(`查找前一天交接班记录: 当前日期=${currentDate}, 前一天=${previousDateStr}`);

  // 修改SQL查询，使用日期范围而不是精确匹配，以处理可能的时区差异
  const sql = `
    SELECT *
    FROM shift_handover h
    WHERE h.shift_date::date = $1::date
       OR DATE_TRUNC('day', h.shift_date) = DATE_TRUNC('day', $1::timestamp)
    ORDER BY h.id DESC
    LIMIT 1
  `;

  try {
    const result = await query(sql, [previousDateStr]);
    console.log(`前一天交接班记录查询结果: 找到${result.rows.length}条记录`);

    if (result.rows.length > 0) {
      const record = result.rows[0];
      console.log(`找到前一天交接班记录: ID=${record.id}, 日期=${record.shift_date}`);

      // 解析details字段
      let details = {};
      try {
        details = typeof record.details === 'string' ? JSON.parse(record.details) : record.details;
      } catch (parseError) {
        console.error('解析前一天交接班详情数据失败:', parseError);
      }

      return {
        ...record,
        details: details,
        paymentData: details.paymentData || null
      };
    }

    // 如果找不到精确匹配的前一天记录，尝试查找最近的记录
    console.log('未找到精确匹配的前一天记录，尝试查找最近的记录');
    const fallbackSql = `
      SELECT *
      FROM shift_handover h
      WHERE h.shift_date < $1::timestamp
      ORDER BY h.shift_date DESC
      LIMIT 1
    `;

    const fallbackResult = await query(fallbackSql, [currentDate]);

    if (fallbackResult.rows.length > 0) {
      const fallbackRecord = fallbackResult.rows[0];
      console.log(`找到最近的交接班记录: ID=${fallbackRecord.id}, 日期=${fallbackRecord.shift_date}`);

      // 解析details字段
      let fallbackDetails = {};
      try {
        fallbackDetails = typeof fallbackRecord.details === 'string' ?
          JSON.parse(fallbackRecord.details) : fallbackRecord.details;
      } catch (parseError) {
        console.error('解析最近交接班详情数据失败:', parseError);
      }

      return {
        ...fallbackRecord,
        details: fallbackDetails,
        paymentData: fallbackDetails.paymentData || null
      };
    }

    console.log('未找到任何可用的前期交接班记录');
    return null;
  } catch (error) {
    console.error('获取前一天交接班记录失败:', error);
    throw error;
  }
}

module.exports = {
  getReceiptDetails,
  getStatistics,
  saveHandover,
  getHandoverHistory,
  exportHandoverToExcel,
  exportNewHandoverToExcel,
  getPreviousHandoverData
};
