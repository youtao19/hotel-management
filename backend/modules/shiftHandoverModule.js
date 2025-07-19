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
 * 获取当天的交接班记录（用于恢复已保存的数据）
 * @param {string} currentDate - 当前日期
 * @returns {Promise<Object|null>} 当天的交接班记录
 */
async function getCurrentHandoverData(currentDate) {
  console.log(`查找当天交接班记录: 日期=${currentDate}`);

  const sql = `
    SELECT *
    FROM shift_handover h
    WHERE h.shift_date::date = $1::date
    ORDER BY h.updated_at DESC
    LIMIT 1
  `;

  try {
    const result = await query(sql, [currentDate]);
    console.log(`当天交接班记录查询结果: 找到${result.rows.length}条记录`);

    if (result.rows.length > 0) {
      const record = result.rows[0];
      console.log(`找到当天交接班记录: ID=${record.id}, 日期=${record.shift_date}, 类型=${record.type}`);

      // 解析details字段
      let details = {};
      try {
        details = typeof record.details === 'string' ? JSON.parse(record.details) : record.details;
      } catch (parseError) {
        console.error('解析当天交接班详情数据失败:', parseError);
      }

      return {
        ...record,
        details: details,
        paymentData: details.paymentData || null
      };
    }

    console.log('未找到当天的交接班记录');
    return null;
  } catch (error) {
    console.error('获取当天交接班记录失败:', error);
    throw error;
  }
}

/**
 * 获取前一天的交接班记录（用于获取备用金）
 * @param {string} currentDate - 当前日期
 * @returns {Promise<Object|null>} 前一天的交接班记录
 */
async function getPreviousHandoverData(currentDate) {
  console.log(`查找交接班记录: 当前日期=${currentDate}`);

  // 🔥 首先检查当天是否有已保存的数据（优先级最高）
  const currentDaySql = `
    SELECT *
    FROM shift_handover h
    WHERE h.shift_date::date = $1::date
    ORDER BY h.updated_at DESC
    LIMIT 1
  `;

  try {
    const currentDayResult = await query(currentDaySql, [currentDate]);
    console.log(`当天交接班记录查询结果: 找到${currentDayResult.rows.length}条记录`);

    if (currentDayResult.rows.length > 0) {
      const currentRecord = currentDayResult.rows[0];
      console.log(`找到当天交接班记录: ID=${currentRecord.id}, 日期=${currentRecord.shift_date}, 类型=${currentRecord.type}`);

      // 解析details字段
      let currentDetails = {};
      try {
        currentDetails = typeof currentRecord.details === 'string' ?
          JSON.parse(currentRecord.details) : currentRecord.details;
      } catch (parseError) {
        console.error('解析当天交接班详情数据失败:', parseError);
      }

      // 如果当天记录包含退押金数据，需要重新生成统计信息
      let enhancedStatistics = null;
      if (currentDetails.refundDeposits && currentDetails.refundDeposits.length > 0) {
        console.log(`当天记录包含 ${currentDetails.refundDeposits.length} 条退押金记录，重新生成统计信息`);

        // 重新获取当天的完整统计数据
        try {
          const todayStats = await getStatistics(currentDate);
          enhancedStatistics = todayStats;

          // 将退押金数据合并到统计中
          currentDetails.refundDeposits.forEach(refund => {
            const method = normalizePaymentMethod(refund.method);
            if (enhancedStatistics.paymentDetails && enhancedStatistics.paymentDetails[method]) {
              enhancedStatistics.paymentDetails[method].hotelDeposit += refund.actualRefundAmount;
            }
          });
        } catch (statsError) {
          console.error('重新生成统计信息失败:', statsError);
        }
      }

      return {
        ...currentRecord,
        details: currentDetails,
        paymentData: currentDetails.paymentData || null,
        statistics: enhancedStatistics || currentRecord.statistics,
        isCurrentDay: true // 标记这是当天的数据
      };
    }

    // 如果当天没有记录，再查找前一天的记录（用于设置备用金）
    console.log('当天没有记录，查找前一天的交接班记录');

    // 计算前一天的日期
    const current = new Date(currentDate);
    const previous = new Date(current);
    previous.setDate(current.getDate() - 1);
    const previousDateStr = previous.toISOString().split('T')[0];

    console.log(`查找前一天交接班记录: 前一天=${previousDateStr}`);

    // 修改SQL查询，使用日期范围而不是精确匹配，以处理可能的时区差异
    const sql = `
      SELECT *
      FROM shift_handover h
      WHERE h.shift_date::date = $1::date
         OR DATE_TRUNC('day', h.shift_date) = DATE_TRUNC('day', $1::timestamp)
      ORDER BY h.id DESC
      LIMIT 1
    `;

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

    console.log('未找到任何可用的交接班记录');
    return null;
  } catch (error) {
    console.error('获取前一天交接班记录失败:', error);
    throw error;
  }
}

/**
 * 导入收款明细到交接班
 * @param {Object} importData - 导入数据
 * @returns {Promise<Object>} 导入结果
 */
async function importReceiptsToShiftHandover(importData) {
  try {
    console.log('📥 开始导入收款明细到交接班:', importData.date)
    console.log('📊 接收到的完整数据:', JSON.stringify(importData, null, 2))

    const { date, paymentAnalysis, statistics } = importData

    // 验证paymentAnalysis数据
    if (!paymentAnalysis) {
      throw new Error('缺少paymentAnalysis数据')
    }

    console.log('💰 支付分析数据:', JSON.stringify(paymentAnalysis, null, 2))
    console.log('📈 统计数据:', JSON.stringify(statistics, null, 2))

    // 检查当天是否已有交接班记录
    const existingQuery = `
      SELECT id, details
      FROM shift_handover
      WHERE shift_date = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `

    const existingResult = await query(existingQuery, [date])

    let handoverId = null
    let existingPaymentData = {}

    if (existingResult.rows.length > 0) {
      // 已有记录，更新现有记录
      handoverId = existingResult.rows[0].id
      try {
        const existingDetails = existingResult.rows[0].details || {}
        existingPaymentData = existingDetails.paymentData || {}
        if (typeof existingPaymentData === 'string') {
          existingPaymentData = JSON.parse(existingPaymentData)
        }
      } catch (e) {
        console.warn('解析现有支付数据失败:', e.message)
        existingPaymentData = {}
      }
      console.log('✏️ 更新现有交接班记录，ID:', handoverId)
    } else {
      // 新建记录
      console.log('🆕 创建新的交接班记录')
    }

    // 将收款明细数据转换为交接班格式
    const updatedPaymentData = {
      cash: {
        reserveCash: existingPaymentData.cash?.reserveCash || 320, // 保持现有备用金或默认值
        hotelIncome: Math.round(paymentAnalysis['现金']?.hotelIncome || 0),
        restIncome: Math.round(paymentAnalysis['现金']?.restIncome || 0),
        carRentIncome: existingPaymentData.cash?.carRentIncome || 0,
        total: 0, // 会在前端重新计算
        hotelDeposit: Math.round(paymentAnalysis['现金']?.hotelDeposit || 0),
        restDeposit: Math.round(paymentAnalysis['现金']?.restDeposit || 0),
        retainedAmount: 320 // 固定值
      },
      wechat: {
        reserveCash: existingPaymentData.wechat?.reserveCash || 0,
        hotelIncome: Math.round(paymentAnalysis['微信']?.hotelIncome || 0),
        restIncome: Math.round(paymentAnalysis['微信']?.restIncome || 0),
        carRentIncome: existingPaymentData.wechat?.carRentIncome || 0,
        total: 0,
        hotelDeposit: Math.round(paymentAnalysis['微信']?.hotelDeposit || 0),
        restDeposit: Math.round(paymentAnalysis['微信']?.restDeposit || 0),
        retainedAmount: existingPaymentData.wechat?.retainedAmount || 0
      },
      digital: {
        reserveCash: existingPaymentData.digital?.reserveCash || 0,
        hotelIncome: Math.round(paymentAnalysis['支付宝']?.hotelIncome || 0),
        restIncome: Math.round(paymentAnalysis['支付宝']?.restIncome || 0),
        carRentIncome: existingPaymentData.digital?.carRentIncome || 0,
        total: 0,
        hotelDeposit: Math.round(paymentAnalysis['支付宝']?.hotelDeposit || 0),
        restDeposit: Math.round(paymentAnalysis['支付宝']?.restDeposit || 0),
        retainedAmount: existingPaymentData.digital?.retainedAmount || 0
      },
      other: {
        reserveCash: existingPaymentData.other?.reserveCash || 0,
        hotelIncome: Math.round((paymentAnalysis['银行卡']?.hotelIncome || 0) + (paymentAnalysis['其他']?.hotelIncome || 0)),
        restIncome: Math.round((paymentAnalysis['银行卡']?.restIncome || 0) + (paymentAnalysis['其他']?.restIncome || 0)),
        carRentIncome: existingPaymentData.other?.carRentIncome || 0,
        total: 0,
        hotelDeposit: Math.round((paymentAnalysis['银行卡']?.hotelDeposit || 0) + (paymentAnalysis['其他']?.hotelDeposit || 0)),
        restDeposit: Math.round((paymentAnalysis['银行卡']?.restDeposit || 0) + (paymentAnalysis['其他']?.restDeposit || 0)),
        retainedAmount: existingPaymentData.other?.retainedAmount || 0
      }
    }

    // 计算各支付方式的总计
    Object.keys(updatedPaymentData).forEach(paymentType => {
      const payment = updatedPaymentData[paymentType]
      payment.total = (payment.reserveCash || 0) + (payment.hotelIncome || 0) +
                     (payment.restIncome || 0) + (payment.carRentIncome || 0)
    })

    // 更新详细信息
    const updatedDetails = {
      ...(existingResult.rows[0]?.details || {}),
      paymentData: updatedPaymentData,
      importInfo: {
        importDate: new Date().toISOString(),
        sourceDate: date,
        sourceType: statistics.receiptType,
        importedAmounts: paymentAnalysis
      }
    }

    if (handoverId) {
      // 更新现有记录
      const updateQuery = `
        UPDATE shift_handover
        SET details = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id
      `

      const updateResult = await query(updateQuery, [
        JSON.stringify(updatedDetails),
        handoverId
      ])

      console.log('✅ 更新交接班记录成功，ID:', updateResult.rows[0].id)
      return { id: updateResult.rows[0].id, action: 'updated' }
    } else {
      // 创建新记录，需要设置必填字段
      const insertQuery = `
        INSERT INTO shift_handover (
          shift_date,
          type,
          details,
          statistics,
          cashier_name,
          shift_time,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `

      // 为新记录设置必要的默认值
      const defaultStatistics = {
        totalRooms: statistics.totalRooms || 0,
        restRooms: statistics.restRooms || 0,
        receiptType: statistics.receiptType || 'hotel'
      }

      const insertResult = await query(insertQuery, [
        date,                              // shift_date
        'import',                          // type
        JSON.stringify(updatedDetails),    // details
        JSON.stringify(defaultStatistics), // statistics
        '系统导入',                         // cashier_name
        'auto'                             // shift_time
      ])

      console.log('✅ 创建交接班记录成功，ID:', insertResult.rows[0].id)
      return { id: insertResult.rows[0].id, action: 'created' }
    }

  } catch (error) {
    console.error('导入收款明细到交接班失败:', error)
    throw error
  }
}

/**
 * 保存金额修改（不保存完整的交接班记录）
 * @param {Object} amountData - 金额数据
 * @returns {Promise<Object>} 保存结果
 */
async function saveAmountChanges(amountData) {
  try {
    console.log('💾 保存金额修改:', amountData.date)

    const { date, paymentData, notes } = amountData

    // 检查当天是否已有记录
    const existingQuery = `
      SELECT id, details
      FROM shift_handover
      WHERE shift_date = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `

    const existingResult = await query(existingQuery, [date])

    if (existingResult.rows.length > 0) {
      // 更新现有记录的金额数据
      const handoverId = existingResult.rows[0].id

      let existingDetails = {}
      try {
        existingDetails = existingResult.rows[0].details || {}
        if (typeof existingDetails === 'string') {
          existingDetails = JSON.parse(existingDetails)
        }
      } catch (e) {
        console.warn('解析现有详情数据失败:', e.message)
        existingDetails = {}
      }

      const updatedDetails = {
        ...existingDetails,
        paymentData: paymentData,
        lastAmountUpdate: new Date().toISOString(),
        notes: notes
      }

      const updateQuery = `
        UPDATE shift_handover
        SET details = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id
      `

      const updateResult = await query(updateQuery, [
        JSON.stringify(updatedDetails),
        handoverId
      ])

      console.log('✅ 金额修改保存成功，ID:', updateResult.rows[0].id)
      return { id: updateResult.rows[0].id, action: 'amount_updated' }
    } else {
      // 创建新记录（仅包含金额数据），需要设置必填字段
      const details = {
        paymentData: paymentData,
        lastAmountUpdate: new Date().toISOString(),
        notes: notes,
        type: 'amount_only'
      }

      const insertQuery = `
        INSERT INTO shift_handover (
          shift_date,
          type,
          details,
          statistics,
          cashier_name,
          shift_time,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `

      // 设置必要的默认值
      const defaultStatistics = {
        type: 'amount_only',
        lastUpdate: new Date().toISOString()
      }

      const insertResult = await query(insertQuery, [
        date,                              // shift_date
        'amount_only',                     // type
        JSON.stringify(details),           // details
        JSON.stringify(defaultStatistics), // statistics
        '系统',                            // cashier_name
        'amount'                           // shift_time (must be ≤10 chars)
      ])

      console.log('✅ 新建金额记录成功，ID:', insertResult.rows[0].id)
      return { id: insertResult.rows[0].id, action: 'amount_created' }
    }

  } catch (error) {
    console.error('保存金额修改失败:', error)
    throw error
  }
}

/**
 * 记录退押金到交接班系统
 * @param {Object} refundData - 退押金数据
 * @returns {Promise<Object>} 更新结果
 */
async function recordRefundDepositToHandover(refundData) {
  try {
    console.log('📝 开始记录退押金到交接班系统:', refundData);

    const {
      orderNumber,
      actualRefundAmount,
      method,
      notes,
      operator,
      refundTime
    } = refundData;

    // 获取退押金日期（使用当前日期，而不是退押金时间的日期）
    // 这样确保退押金记录到当天的交接班中
    const refundDate = new Date().toISOString().split('T')[0];

    // 检查当天是否已有交接班记录
    const existingQuery = `
      SELECT id, details
      FROM shift_handover
      WHERE shift_date = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const existingResult = await query(existingQuery, [refundDate]);
    let handoverId = null;
    let existingDetails = {};

    if (existingResult.rows.length > 0) {
      handoverId = existingResult.rows[0].id;
      existingDetails = existingResult.rows[0].details || {};
      console.log('📋 找到现有交接班记录，ID:', handoverId);
    }

    // 构建退押金记录
    const refundRecord = {
      orderNumber,
      actualRefundAmount,
      method,
      notes: notes || '',
      operator,
      refundTime,
      type: 'deposit_refund'
    };

    // 标准化支付方式名称
    const standardizedMethod = normalizePaymentMethod(method);

    // 更新交接班详情
    const updatedDetails = {
      ...existingDetails,
      refundDeposits: [
        ...(existingDetails.refundDeposits || []),
        refundRecord
      ],
      // 更新支付数据中的退押金统计
      paymentData: {
        ...existingDetails.paymentData,
        [standardizedMethod]: {
          ...existingDetails.paymentData?.[standardizedMethod],
          // 增加退押金金额（作为支出）
          refundDeposit: (existingDetails.paymentData?.[standardizedMethod]?.refundDeposit || 0) + actualRefundAmount,
          // 更新总计（减去退押金）
          total: (existingDetails.paymentData?.[standardizedMethod]?.total || 0) - actualRefundAmount
        }
      },
      lastRefundUpdate: new Date().toISOString()
    };

    // 同时更新统计数据中的 paymentDetails（用于前端显示）
    if (existingDetails.statistics && existingDetails.statistics.paymentDetails) {
      if (!updatedDetails.statistics) {
        updatedDetails.statistics = { ...existingDetails.statistics };
      }
      if (!updatedDetails.statistics.paymentDetails) {
        updatedDetails.statistics.paymentDetails = { ...existingDetails.statistics.paymentDetails };
      }

      // 确保支付方式存在
      if (!updatedDetails.statistics.paymentDetails[standardizedMethod]) {
        updatedDetails.statistics.paymentDetails[standardizedMethod] = {
          hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0
        };
      }

      // 更新退押金统计（增加退押金金额）
      updatedDetails.statistics.paymentDetails[standardizedMethod].hotelDeposit += actualRefundAmount;
    }



    if (handoverId) {
      // 更新现有记录
      const updateQuery = `
        UPDATE shift_handover
        SET details = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id
      `;

      const updateResult = await query(updateQuery, [
        JSON.stringify(updatedDetails),
        handoverId
      ]);

      console.log('✅ 更新交接班记录成功，ID:', updateResult.rows[0].id);
      return { id: updateResult.rows[0].id, action: 'updated' };
    } else {
      // 创建新记录
      const insertQuery = `
        INSERT INTO shift_handover (
          shift_date,
          type,
          details,
          statistics,
          cashier_name,
          shift_time,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;

      const defaultStatistics = {
        type: 'refund_only',
        lastUpdate: new Date().toISOString()
      };

      const insertResult = await query(insertQuery, [
        refundDate,                        // shift_date
        'refund',                          // type
        JSON.stringify(updatedDetails),    // details
        JSON.stringify(defaultStatistics), // statistics
        operator,                          // cashier_name
        'refund'                           // shift_time
      ]);

      console.log('✅ 创建交接班记录成功，ID:', insertResult.rows[0].id);
      return { id: insertResult.rows[0].id, action: 'created' };
    }

  } catch (error) {
    console.error('记录退押金到交接班系统失败:', error);
    throw error;
  }
}

/**
 * 删除交接班记录
 * @param {number} recordId - 记录ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteHandoverRecord(recordId) {
  try {
    console.log(`开始删除交接班记录，ID: ${recordId}`);

    // 首先检查记录是否存在
    const checkQuery = 'SELECT id, shift_date, cashier_name FROM shift_handover WHERE id = $1';
    const checkResult = await query(checkQuery, [recordId]);

    if (checkResult.rows.length === 0) {
      console.log(`交接班记录不存在，ID: ${recordId}`);
      return {
        success: false,
        message: '交接班记录不存在'
      };
    }

    const record = checkResult.rows[0];
    console.log(`找到交接班记录: ID=${record.id}, 日期=${record.shift_date}, 收银员=${record.cashier_name}`);

    // 执行删除操作
    const deleteQuery = 'DELETE FROM shift_handover WHERE id = $1';
    const deleteResult = await query(deleteQuery, [recordId]);

    if (deleteResult.rowCount > 0) {
      console.log(`✅ 交接班记录删除成功，ID: ${recordId}`);
      return {
        success: true,
        message: '交接班记录删除成功',
        deletedRecord: record
      };
    } else {
      console.log(`❌ 交接班记录删除失败，ID: ${recordId}`);
      return {
        success: false,
        message: '删除操作失败'
      };
    }

  } catch (error) {
    console.error('删除交接班记录失败:', error);
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
  getPreviousHandoverData,
  getCurrentHandoverData,
  importReceiptsToShiftHandover,
  saveAmountChanges,
  recordRefundDepositToHandover,
  deleteHandoverRecord
};
