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

    // 微邮付相关
    'alipay': '微邮付',
    'zhifubao': '微邮付',
    '微邮付': '微邮付',
    'weiyoufu': '微邮付',

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
  if (method.includes('微邮付') || method.includes('weiyoufu') || method.includes('微邮付')) {
    return '微邮付';
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
  // 以订单为主：根据 orders.room_price 的每日价格，生成 [startDate, endDate] 区间内的逐日收款明细
  // 首日计入押金，其余仅计房费；支付方式取自 orders.payment_method

  // 订单类型条件 - 使用 stay_type 字段
  let typeCondition = '1=1';
  if (type === 'hotel') {
    typeCondition = `o.stay_type = '客房'`;
  } else if (type === 'rest') {
    typeCondition = `o.stay_type = '休息房'`;
  }

  const sql = `
    SELECT
      o.order_id,
      o.room_number,
      o.guest_name,
      o.payment_method,
      o.room_price,
      o.deposit,
      o.check_in_date,
      o.check_out_date,
      o.stay_type
    FROM orders o
    WHERE ${typeCondition}
      AND o.status IN ('checked-in', 'checked-out', 'pending')
      AND o.check_in_date::date <= $2::date AND o.check_out_date::date >= $1::date
    ORDER BY o.order_id DESC
  `;

  try {
    const result = await query(sql, [startDate, endDate]);

  // 辅助：范围判断基于 YYYY-MM-DD 字符串
  const inRange = (dStr) => String(dStr) >= String(startDate) && String(dStr) <= String(endDate);

    const rows = [];
    for (const o of result.rows) {
      let rp = o.room_price;
      if (typeof rp === 'string') {
        try { rp = JSON.parse(rp || '{}'); } catch { rp = {}; }
      }
      const keys = Object.keys(rp || {}).sort();
      const firstDay = keys[0];
      for (const day of keys) {
        if (!inRange(day)) continue;
        const roomFee = Number(rp[day] || 0);
        const deposit = (day === firstDay) ? Number(o.deposit || 0) : 0;
        const total = roomFee + deposit;
        rows.push({
          id: `${o.order_id}-${day}`,
          order_number: o.order_id,
          room_number: o.room_number,
          guest_name: o.guest_name,
          room_fee: roomFee,
          deposit: deposit,
          payment_method: normalizePaymentMethod(o.payment_method || '现金'),
          total_amount: total,
          check_in_date: o.check_in_date,
          check_out_date: o.check_out_date,
          created_at: `${day}T00:00:00`,
          stay_date: day,
          business_type: o.stay_type === '客房' ? 'hotel' : 'rest'
        });
      }
    }

    // 按 stay_date DESC、order_number DESC 排序
    rows.sort((a, b) => (b.stay_date.localeCompare(a.stay_date)) || (b.order_number.localeCompare(a.order_number)));
    return rows;
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
  // 以天为单位统计收入：从 orders.room_price 逐日聚合；退押金从 bills(change_type='退押') 汇总
  const finalEndDate = endDate || startDate;

  // 辅助：生成日期数组
  const toDate = (s) => new Date(`${s}T00:00:00`);
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const days = [];
  for (let d = toDate(startDate); d <= toDate(finalEndDate); d.setDate(d.getDate() + 1)) {
    days.push(toStr(new Date(d)));
  }

  // 初始化统计数据
  const statistics = {
    hotelIncome: 0,
    restIncome: 0,
    carRentalIncome: 0,
    totalIncome: 0,
    hotelDeposit: 0,   // 退押金（支出）
    restDeposit: 0,    // 退押金（支出）
    retainedAmount: 0,
    handoverAmount: 0,
    goodReviews: 0,
    totalRooms: 0,
    restRooms: 0,
    paymentBreakdown: {
      '现金': 0,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    },
    paymentDetails: {
      '现金': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
      '微信': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
      '微邮付': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
      '其他': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 }
    }
  };

  try {
    // 逐日查询入住中的订单，并按“首日+押金，其余仅房费”计入收入
    for (const day of days) {
      const ordSql = `
        SELECT order_id, check_in_date, check_out_date, room_price, deposit, payment_method, stay_type
        FROM orders
        WHERE check_in_date <= $1::date AND $1::date < check_out_date
          AND status IN ('checked-in', 'checked-out', 'pending')
      `;
      const ordRes = await query(ordSql, [day]);

      for (const row of ordRes.rows) {
        // 解析 room_price JSON
        let rp = row.room_price;
        if (typeof rp === 'string') {
          try { rp = JSON.parse(rp || '{}'); } catch { rp = {}; }
        }
        const keys = Object.keys(rp || {}).sort();
        const isFirstDay = keys.length > 0 && day === keys[0];
        const roomFee = Number(rp?.[day] || 0);
        const deposit = Number(row.deposit || 0);
        const incomeToday = roomFee + (isFirstDay ? deposit : 0);

        const businessType = (row.stay_type === '客房') ? 'hotel' : 'rest';
        const pm = normalizePaymentMethod(row.payment_method || '现金');
        const pmKey = statistics.paymentDetails[pm] ? pm : '其他';

        if (businessType === 'hotel') {
          statistics.hotelIncome += incomeToday;
          statistics.paymentDetails[pmKey].hotelIncome += incomeToday;
        } else {
          statistics.restIncome += incomeToday;
          statistics.paymentDetails[pmKey].restIncome += incomeToday;
        }

        // 总收入的支付方式分布（不含退押金）
        statistics.paymentBreakdown[pmKey] += incomeToday;
      }
    }

    // 退押金：从 bills 的 change 记录统计 - 使用 stay_type 字段
    const refundSql = `
      SELECT
        SUM(ABS(COALESCE(b.change_price,0))) AS amount,
        o.payment_method,
        CASE WHEN o.stay_type = '客房' THEN 'hotel' ELSE 'rest' END AS business_type
      FROM bills b
      JOIN orders o ON o.order_id = b.order_id
      WHERE b.change_type = '退押' AND b.create_time::date BETWEEN $1::date AND $2::date
      GROUP BY o.payment_method, business_type
    `;
    const refundRes = await query(refundSql, [startDate, finalEndDate]);
    for (const r of refundRes.rows) {
      const amount = Number(r.amount || 0);
      const pm = normalizePaymentMethod(r.payment_method || '现金');
      const pmKey = statistics.paymentDetails[pm] ? pm : '其他';
      if (r.business_type === 'hotel') {
        statistics.hotelDeposit += amount; // 退押金（支出）
        statistics.paymentDetails[pmKey].hotelDeposit += amount;
      } else {
        statistics.restDeposit += amount;
        statistics.paymentDetails[pmKey].restDeposit += amount;
      }
    }

        // 房间统计：按"开房数/休息房数"（以 check_in_date 当天计数） - 使用 stay_type 字段
    const roomStatsSql = `
      SELECT
        CASE WHEN o.stay_type = '客房' THEN 'hotel' ELSE 'rest' END as business_type,
        COUNT(*) as room_count
      FROM orders o
      WHERE o.check_in_date::date BETWEEN $1::date AND $2::date
        AND o.status IN ('checked-in', 'checked-out', 'pending')
      GROUP BY business_type
    `;
    const roomStats = await query(roomStatsSql, [startDate, finalEndDate]);
    for (const row of roomStats.rows) {
      const count = Number(row.room_count || 0);
      if (row.business_type === 'hotel') statistics.totalRooms += count; else statistics.restRooms += count;
    }

    // 汇总总收入与交接款
    statistics.totalIncome = statistics.hotelIncome + statistics.restIncome + statistics.carRentalIncome;
    statistics.handoverAmount = statistics.totalIncome + (statistics.reserveCash || 0)
                              - statistics.hotelDeposit - statistics.restDeposit - (statistics.retainedAmount || 0);

    return statistics;
  } catch (error) {
    console.error('获取统计数据失败:', error);
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

    const { type, statistics, date } = handoverData;

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

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
async function getCurrentHandoverData(date) {
  let sqlQuery = `SELECT * FROM shift_handover WHERE shift_date = $1`;
  const values = [date];

  const result = await query(sqlQuery, values);
  return result.rows[0] || null;
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

      // 如果当天记录包含退押金数据，需要重新生成统计信息
      let enhancedStatistics = null;
      if (currentRecord.refundDeposits && currentRecord.refundDeposits.length > 0) {
        console.log(`当天记录包含 ${currentRecord.refundDeposits.length} 条退押金记录，重新生成统计信息`);

        // 重新获取当天的完整统计数据
        try {
          const todayStats = await getStatistics(currentDate);
          enhancedStatistics = todayStats;

          // 将退押金数据合并到统计中
          currentRecord.refundDeposits.forEach(refund => {
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
        paymentData: currentRecord.paymentData || null,
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

      return {
        ...record,
        paymentData: record.paymentData || null
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

      return {
        ...fallbackRecord,
        paymentData: fallbackRecord.paymentData || null
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
 * 保存页面数据（保存完整的页面数据，包括金额、统计数据等）
 * @param {Object} pageData - 页面数据
 * @returns {Promise<Object>} 保存结果
 */
async function saveAmountChanges(amountData) {
  const {
    date,
    taskList, // Admin-added memos
    vipCards, // From specialStats
    cashierName, // From specialStats
    handoverPerson, // Add this
    receivePerson,  // Add this
    notes           // Add this
  } = amountData;

  // Prepare statistics JSONB for saving vipCards
  const statisticsToSave = {
    vipCards: vipCards || 0 // Only save vipCards here
  };

  // 尝试查找现有记录
  let existingRecord = await query(
    `SELECT * FROM shift_handover WHERE shift_date = $1`,
    [date]
  );

  if (existingRecord.rows.length > 0) {
    // 更新现有记录
    const sqlQuery = `
      UPDATE shift_handover
      SET
        task_list = $1,
        statistics = $2,
        cashier_name = $3,
        handover_person = $5,
        receive_person = $6,
        remarks = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE shift_date = $4
      RETURNING *;
    `;
    const values = [
      JSON.stringify(taskList || []),
      JSON.stringify(statisticsToSave), // Use statisticsToSave for vipCards
      cashierName || '',
      date,
      handoverPerson || '',
      receivePerson || '',
      notes || ''
    ];
    const result = await query(sqlQuery, values);
    if (result.rows.length === 0) {
        // If no record was updated, it means there was no existing record for the given date.
        // In this case, we should insert a new record.
        const insertSqlQuery = `
            INSERT INTO shift_handover (shift_date, task_list, statistics, cashier_name, shift_time, handover_person, receive_person, remarks)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (shift_date) DO UPDATE SET
                task_list = EXCLUDED.task_list,
                statistics = EXCLUDED.statistics,
                cashier_name = EXCLUDED.cashier_name,
                handover_person = EXCLUDED.handover_person,
                receive_person = EXCLUDED.receive_person,
                remarks = EXCLUDED.remarks,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const insertValues = [
            date,
            JSON.stringify(taskList || []),
            JSON.stringify(statisticsToSave), // Use statisticsToSave for vipCards
            cashierName || '',
            new Date().toTimeString().slice(0, 5),
            handoverPerson || '',
            receivePerson || '',
            notes || ''
        ];
        return (await query(insertSqlQuery, insertValues)).rows[0];
    }
    return result.rows[0];
  } else {
    // 插入新的记录
    const sqlQuery = `
      INSERT INTO shift_handover (shift_date, task_list, statistics, cashier_name, shift_time, handover_person, receive_person, remarks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      date,
      JSON.stringify(taskList || []),
      JSON.stringify(statisticsToSave), // Use statisticsToSave for vipCards
      cashierName || '',
      new Date().toTimeString().slice(0, 5),
      handoverPerson || '',
      receivePerson || '',
      notes || ''
    ];
    return (await query(sqlQuery, values)).rows[0];
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

    // 首先获取订单信息以获取退房日期
  const orderQuery = 'SELECT (check_out_date::date)::text AS check_out_date FROM orders WHERE order_id = $1';
    const orderResult = await query(orderQuery, [orderNumber]);

    if (orderResult.rows.length === 0) {
      throw new Error(`订单号 '${orderNumber}' 不存在`);
    }

  const order = orderResult.rows[0];
  // 使用订单的退房日期作为交接班日期（直接使用数据库的 date 字段文本，避免 UTC 偏移）
  const refundDate = order.check_out_date; // e.g. '2025-08-31'
    console.log(`📅 使用订单退房日期作为交接班日期: ${refundDate}`);

    // 检查退房日期是否已有交接班记录
    const existingQuery = `
      SELECT id
      FROM shift_handover
      WHERE shift_date = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const existingResult = await query(existingQuery, [refundDate]); // 检查退房日期是否已有交接班记录
    let handoverId = null; // 交接班记录ID

    if (existingResult.rows.length > 0) {
      handoverId = existingResult.rows[0].id; // 交接班记录ID
      console.log('📋 找到退房日期的现有交接班记录，ID:', handoverId);
    }

    // 构建退押金记录
    const refundRecord = {
      orderNumber, // 订单号
      actualRefundAmount, // 实际退款金额
      method, // 退款方式
      notes: notes || '', // 备注
      operator, // 操作员
      refundTime, // 退款时间
      type: 'deposit_refund' // 类型
    };

    // 标准化支付方式名称
    const standardizedMethod = normalizePaymentMethod(method);

    // 更新交接班详情
    const updatedStatistics = {
      // 同时更新统计数据中的 paymentDetails（用于前端显示）
      paymentDetails: {
        // 确保支付方式存在
        [standardizedMethod]: {
          hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0
        }
      }
    };

    // 更新退押金统计（增加退押金金额）
    updatedStatistics.paymentDetails[standardizedMethod].hotelDeposit += actualRefundAmount;

    if (handoverId) {
      // 更新现有记录
      const updateQuery = `
        UPDATE shift_handover
        SET statistics = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id
      `;

      const updateResult = await query(updateQuery, [
        JSON.stringify(updatedStatistics),
        handoverId
      ]);

      console.log('✅ 更新交接班记录成功，ID:', updateResult.rows[0].id);
      return { id: updateResult.rows[0].id, action: 'updated' };
    } else {
      // 为退房日期创建新的交接班记录
      const insertQuery = `
        INSERT INTO shift_handover (
          shift_date,
          statistics,
          cashier_name,
          shift_time,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;

      const defaultStatistics = {
        type: 'refund_only',
        lastUpdate: new Date().toISOString()
      };

      const insertResult = await query(insertQuery, [
        refundDate,                        // shift_date
        JSON.stringify(updatedStatistics), // statistics
        operator,                          // cashier_name
        'refund'                           // shift_time
      ]);

      console.log('✅ 为退房日期创建交接班记录成功，ID:', insertResult.rows[0].id);
      return { id: insertResult.rows[0].id, action: 'created' };
    }

  } catch (error) {
    console.error('记录退押金到交接班系统失败:', error);
    throw error;
  }
}

/**
 * 获取表格数据
 * @param {date} date - 查询日期
 * @returns {Promise<Object>} 交接班表格数据
 */
async function getShiftTable(date) {
  try {
    // 保留旧签名兼容，允许 data 为对象或字符串日期
    const targetDate = typeof date === 'string' ? date : (date?.date || new Date().toISOString().slice(0,10));
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      throw new Error('日期格式应为 YYYY-MM-DD');
    }

    // 查询客房入账 - 使用 stay_type 字段
    const incomeSql = `
      SELECT
        order_id,
        guest_name,
        deposit,
        room_price,
        payment_method,
        stay_type,
        (check_in_date::date)::text AS check_in_date,
        (check_out_date::date)::text AS check_out_date
      FROM orders
      WHERE check_in_date::date <= $1::date AND $1::date < check_out_date::date
        AND stay_type = '客房'
      ORDER BY order_id ASC`;
    const incomeRes = await query(incomeSql, [targetDate]);

    let records = {};

    for (let item of incomeRes.rows) {
      const keys = Object.keys(item.room_price || {}).sort();
      const isFirstDay = keys.length > 0 && targetDate === keys[0];
      let totalIncome = 0;
      if (isFirstDay) {
        // 如果是第一天，记录押金和房费
        totalIncome += Number(item.deposit || 0) + Number(item.room_price[targetDate] || 0);
      }else{
        totalIncome += Number(item.room_price[targetDate] || 0);
      }

      const record = {
        order_id: item.order_id,
        guest_name: item.guest_name || '',
        deposit: Number(item.deposit || 0),
        room_price: Number(item.room_price[targetDate] || 0),
        payment_method: item.payment_method || '',
        stay_type: item.stay_type || '',
        totalIncome: totalIncome,
        check_in_date: item.check_in_date || '',
        check_out_date: item.check_out_date || ''
      }

      records[item.order_id] = record;
    }

    // 查询休息房入账 - 使用 stay_type 字段
    const restIncomeSql = `
      SELECT
        order_id,
        guest_name,
        deposit,
        room_price,
        payment_method,
        stay_type,
        (check_in_date::date)::text AS check_in_date,
        (check_out_date::date)::text AS check_out_date
      FROM orders
      WHERE check_in_date::date = $1::date
        AND stay_type = '休息房'
      ORDER BY order_id ASC`;
    const restIncomeRes = await query(restIncomeSql, [targetDate]);

    for (let item of restIncomeRes.rows) {
      const record = {
        order_id: item.order_id,
        guest_name: item.guest_name || '',
        deposit: Number(item.deposit || 0),
        room_price: Number(item.room_price[targetDate] || 0),
        payment_method: item.payment_method || '',
        stay_type: item.stay_type || '',
        totalIncome: Number(item.deposit || 0) + Number(item.room_price[targetDate] || 0),
        check_in_date: item.check_in_date || '',
        check_out_date: item.check_out_date || ''
      }

      records[item.order_id] = record;
    }

    // 查询退押金 - 关联订单表获取stay_type信息
    const refundBillsSql = `
      SELECT
        b.bill_id,
        b.order_id,
        b.change_price,
        b.change_type,
        b.pay_way,
        o.stay_type,
        o.guest_name
      FROM bills b
      JOIN orders o ON b.order_id = o.order_id
      WHERE b.create_time::date = $1::date
        AND (b.change_type = '退押' OR b.change_type = '退款')
      ORDER BY b.bill_id ASC`;
    const refundBillsRes = await query(refundBillsSql, [targetDate]);

    const refunds = refundBillsRes.rows.map(row => ({
      bill_id: row.bill_id,
      order_id: row.order_id,
      change_price: Number(row.change_price || 0),
      change_type: row.change_type || '',
      pay_way: row.pay_way || '',
      stay_type: row.stay_type || '',
      guest_name: row.guest_name || ''
    }));

    const otherIncomeSql = `
      SELECT
        bill_id,
        order_id,
        pay_way,
        change_price,
        change_type,
        stay_type
      FROM bills
      WHERE create_time::date = $1::date
        AND change_type = '补收'
      ORDER BY bill_id ASC
      `;
    const otherIncomeRes = await query(otherIncomeSql, [targetDate]);

    // 按照支付方式分别计算总和
    let otherIncomeTotal = {};

    otherIncomeRes.rows.forEach(row => {
      otherIncomeTotal[row.pay_way] = (otherIncomeTotal[row.pay_way] || 0) + Number(row.change_price || 0);
    });


    const result = {
      date: targetDate,
      records,
      refunds,
      otherIncomeTotal
    };
    return result;
  } catch (error) {
    console.error('获取交接班表格数据失败:', error);
    throw error;
  }
}


/**
 * 获取备忘录数据
 * @param {date} date - 查询日期
 * @returns {Promise<Array>} 备忘录数据
 */
async function getRemarks({ date }) {
  try {
    const querySql = `
      SELECT order_id, room_number, remarks
      FROM orders
      WHERE check_in_date::date = $1::date
    `;
    const result = await query(querySql, [date]);
    return result.rows;
  } catch (error) {
    console.error('获取备忘录数据失败:', error);
    throw error;
  }
}

/**
 * 获取交接班页面的特殊统计：开房数、休息房数、好评（邀/得）
 * @param {string} date - 日期 YYYY-MM-DD
 * @returns {Promise<Object>} { openCount, restCount, invited, positive }
 */
async function getShiftSpecialStats(date) {
  const targetDate = date || new Date().toISOString().split('T')[0]

  // 统计开房/休息房数量：使用 stay_type 字段
  const roomCountSql = `
    SELECT
      SUM(CASE WHEN o.stay_type = '客房' THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN o.stay_type = '休息房' THEN 1 ELSE 0 END) AS rest_count
    FROM orders o
    WHERE o.check_in_date::date = $1::date
      AND o.status IN ('checked-in', 'checked-out', 'pending')
  `

  // 统计好评邀/得：以订单退房日期为该日计算
  // 统计好评邀/得：按邀请/更新发生在当天统计（不再依赖订单退房日）
  const reviewSql = `
    SELECT
      COUNT(*) FILTER (
        WHERE ri.invited = TRUE AND ri.invite_time::date = $1::date
      ) AS invited,
      COUNT(*) FILTER (
        WHERE ri.positive_review = TRUE AND ri.update_time::date = $1::date
      ) AS positive
    FROM review_invitations ri
  `

  try {
    const [roomRes, reviewRes] = await Promise.all([
      query(roomCountSql, [targetDate]),
      query(reviewSql, [targetDate])
    ])

    const openCount = Number(roomRes.rows?.[0]?.open_count || 0)
    const restCount = Number(roomRes.rows?.[0]?.rest_count || 0)
    const invited = Number(reviewRes.rows?.[0]?.invited || 0)
    const positive = Number(reviewRes.rows?.[0]?.positive || 0)

    return { openCount, restCount, invited, positive }
  } catch (error) {
    console.error('获取交接班特殊统计失败:', error)
    throw error
  }
}

/**
 * 保存备用金
 * @param {string} date - 日期
 * @param {object|number} reserveCash - 备用金金额
 * @returns {Promise<Object>} 保存结果
 */
async function saveReserve(date, reserveCash) {
  try {
    // 规范化传入的备用金数据
    let payloadObj;
    if (typeof reserveCash === 'number') {
      payloadObj = { cash: reserveCash, wechat: 0, digital: 0, other: 0 };
    } else if (reserveCash && typeof reserveCash === 'object') {
      payloadObj = {
        cash: Number(reserveCash.cash || reserveCash.reserveCash || 0),
        wechat: Number(reserveCash.wechat || 0),
        digital: Number(reserveCash.digital || 0),
        other: Number(reserveCash.other || 0)
      };
    } else {
      payloadObj = { cash: 0, wechat: 0, digital: 0, other: 0 };
    }

    // 完整的 INSERT ... ON CONFLICT 语句
    // 插入时为 NOT NULL 列提供默认值或空字符串，ON CONFLICT 时只更新 reserve_cash
    const sqlQuery = `
      INSERT INTO shift_handover (shift_date, reserve_cash, updated_at, cashier_name, shift_time)
      VALUES ($1, $2, CURRENT_TIMESTAMP, '', '')
      ON CONFLICT (shift_date) DO UPDATE
      SET
        reserve_cash = EXCLUDED.reserve_cash,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    // 准备 SQL 语句的值
    const values = [
      date,
      JSON.stringify(payloadObj)
    ];

    // 执行查询并返回结果
    const result = await query(sqlQuery, values);
    return result.rows[0];
  } catch (error) {
    console.error('保存备用金失败:', error);
    throw error;
  }
}

// 获取某日备用金（若不存在返回 null）
async function getReserveCash(date) {
  try {
    const result = await query(`SELECT reserve_cash FROM shift_handover WHERE shift_date = $1 ORDER BY updated_at DESC LIMIT 1`, [date]);
    if (result.rows.length === 0) {
      return null; // 没有记录
    }
    let reserveData = result.rows[0].reserve_cash;
    if (!reserveData) return null; // 字段为空
    // 兼容字符串 / JSONB
    if (typeof reserveData === 'string') {
      try { reserveData = JSON.parse(reserveData); } catch (_) { /* ignore */ }
    }
    // 统一输出结构
    return {
      cash: Number(reserveData.cash || reserveData.reserveCash || 0),
      wechat: Number(reserveData.wechat || 0),
      digital: Number(reserveData.digital || 0),
      other: Number(reserveData.other || 0)
    };
  } catch (error) {
    console.error('获取备用金失败:', error);
    throw error;
  }
}

module.exports = {
  getReceiptDetails,
  getStatistics,
  exportHandoverToExcel,
  exportNewHandoverToExcel,
  getPreviousHandoverData,
  getCurrentHandoverData,
  saveAmountChanges,
  recordRefundDepositToHandover,
  getShiftTable,
  getRemarks,
  getShiftSpecialStats,
  saveReserve,
  getReserveCash
};
