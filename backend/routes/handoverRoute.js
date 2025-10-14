const express =  require('express');
const router = express.Router();
const { query, getClient } = require('../database/postgreDB/pg');
const db = require("../database/postgreDB/pg")

const {
  getShiftTable,
  getRemarks,
  getShiftSpecialStats,
  startHandover,
  getHandoverTableData,
  saveAdminMemoToHandover,
  getAdminMemosFromHandover,
  checkYesterdayHandoverRecord
} = require('../modules/handoverModule');


// 获取交接班表格数据（计算版本）
router.get('/table', async (req, res) => {
  const { date } = req.query;
  try {
    const tableData = await getShiftTable(date);
    res.json({ success: true, data: tableData });
  } catch (error) {
    console.error('Error fetching shift table data:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取交接班表格数据（从handover表查询）
router.get('/handover-table', async (req, res) => {
  const { date } = req.query;
  try {
    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    const tableData = await getHandoverTableData(date);
    res.json({ success: true, data: tableData });
  } catch (error) {
    console.error('Error fetching handover table data:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取交接班数据失败'
    });
  }
});

// 获取备忘录数据
router.get('/remarks', async (req, res) => {
  console.log('开始获取备忘录数据')
  try {
    const { date } = req.query;
    const data = await getRemarks({ date });
    res.json({ success: true, data });
    console.log('备忘录数据获取成功',data)
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取交接班页面特殊统计（开房数、休息房数、好评邀/得）
router.get('/special-stats', async (req, res) => {
  try {
    const { date } = req.query;
    const data = await getShiftSpecialStats(date);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取交接班特殊统计失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取交接班表中的管理员备忘录
router.get('/admin-memos', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    const memos = await getAdminMemosFromHandover(date);
    res.json({
      success: true,
      data: memos,
      message: '获取管理员备忘录成功'
    });
  } catch (error) {
    console.error('获取管理员备忘录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取管理员备忘录失败'
    });
  }
});

// 保存管理员备忘录到交接班表
router.post('/save-admin-memo', async (req, res) => {
  try {
    console.log('收到保存管理员备忘录请求:', {
      body: JSON.stringify(req.body, null, 2),
      timestamp: new Date().toISOString()
    });

    // 基本数据验证
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: '请求数据为空'
      });
    }

    const { date, memo } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    if (!memo || !memo.trim()) {
      return res.status(400).json({
        success: false,
        message: '备忘录内容不能为空'
      });
    }

    const result = await saveAdminMemoToHandover({ date, memo: memo.trim() });

    console.log('管理员备忘录保存成功:', result);

    res.json({
      success: true,
      data: result.data,
      message: result.message || '管理员备忘录保存成功'
    });

  } catch (error) {
    console.error('保存管理员备忘录失败:', {
      message: error.message,
      stack: error.stack,
      requestBody: JSON.stringify(req.body, null, 2)
    });

    res.status(500).json({
      success: false,
      message: error.message || '保存失败',
      timestamp: new Date().toISOString()
    });
  }
});




router.get('/check-yesterday', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    console.log('检查交接记录，查询日期:', date);

    // 前端已经根据交接时间规则（8:00）计算好了要查询的交接记录日期
    // 后端直接查询这个日期的交接记录即可
    const queryDate = date;

    console.log('实际查询日期:', queryDate);

    // 查询指定日期是否有完整的交接记录
    // 完整的交接记录需要包含所有4种支付方式（1=现金, 2=微信, 3=微邮付, 4=其他）
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

    const result = await query(sql, [queryDate]);

    // 判断是否有完整的交接记录
    const hasRecord = result.rows.length > 0;
    const paymentCount = hasRecord ? Number(result.rows[0].payment_count) : 0;
    const isComplete = hasRecord && paymentCount === 4;

    // 如果有完整记录，查询各支付方式的交接款金额
    let handoverAmounts = {
      cash: 0,
      wechat: 0,
      weyoufu: 0,
      other: 0
    };

    if (isComplete) {
      const amountSql = `
        SELECT
          payment_type,
          handover as handover_amount
        FROM handover
        WHERE date = $1::date
          AND payment_type IN (1, 2, 3, 4)
        ORDER BY payment_type
      `;

      const amountResult = await query(amountSql, [queryDate]);

      // 将查询结果转换为前端需要的格式
      // payment_type: 1=现金, 2=微信, 3=微邮付, 4=其他
      amountResult.rows.forEach(row => {
        const amount = Number(row.handover_amount) || 0;
        switch (row.payment_type) {
          case 1:
            handoverAmounts.cash = amount;
            break;
          case 2:
            handoverAmounts.wechat = amount;
            break;
          case 3:
            handoverAmounts.weyoufu = amount;
            break;
          case 4:
            handoverAmounts.other = amount;
            break;
        }
      });

      console.log('查询到的交接款金额:', handoverAmounts);
    }

    const responseData = {
      date: queryDate,  // 返回实际查询的日期
      hasRecord,
      isComplete,
      paymentCount,
      paymentTypes: hasRecord ? result.rows[0].payment_types : [],
      handoverPerson: hasRecord ? result.rows[0].handover_person : null,
      takeoverPerson: hasRecord ? result.rows[0].takeover_person : null,
      handoverAmounts: handoverAmounts  // 新增：返回昨日的交接款金额
    };

    console.log('交接记录检查结果:', responseData);

    res.json({
      success: true,
      data: responseData,
      message: isComplete ? '已完成交接' : (hasRecord ? '交接记录不完整' : '无交接记录')
    });
  } catch (error) {
    console.error('检查交接记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '检查交接记录失败'
    });
  }
});

// 查询所有交接班记录
router.get('/query', async (req, res) => {
  try {
    console.log('开始查询交接班记录');

    // 查询所有有完整交接记录的日期
    // 判断标准：一个日期如果包含四种支付方式（1,2,3,4），那么这个日期表示有交接记录
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

    // 格式化返回数据
    const handoverRecords = result.rows.map(row => ({
      date: row.date, // 现在date已经是字符串格式
      handoverPerson: row.handover_person || '',
      takeoverPerson: row.takeover_person || '',
      vipCards: parseInt(row.vip_cards) || 0,
      taskList: row.task_list || [],
      remarks: row.remarks || '',
      paymentCount: parseInt(row.payment_count) || 0
    }));

    console.log(`找到 ${handoverRecords.length} 条交接班记录`);

    res.json({
      success: true,
      data: handoverRecords,
      message: `成功查询到 ${handoverRecords.length} 条交接班记录`
    });

  } catch (error) {
    console.error('查询交接班记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '查询交接班记录失败'
    });
  }
});

// 根据日期范围查询交接班记录
router.get('/query-by-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    console.log('开始按日期范围查询交接班记录:', { startDate, endDate });

    let sql = `
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
    `;

    const params = [];

    // 如果提供了开始日期
    if (startDate) {
      sql += ` AND date >= $${params.length + 1}::date`;
      params.push(startDate);
    }

    // 如果提供了结束日期
    if (endDate) {
      sql += ` AND date <= $${params.length + 1}::date`;
      params.push(endDate);
    }

    sql += `
      GROUP BY date
      HAVING COUNT(DISTINCT payment_type) = 4
      ORDER BY date DESC
    `;

    const result = await query(sql, params);

    // 格式化返回数据
    const handoverRecords = result.rows.map(row => ({
      date: row.date, // 现在date已经是字符串格式
      handoverPerson: row.handover_person || '',
      takeoverPerson: row.takeover_person || '',
      vipCards: parseInt(row.vip_cards) || 0,
      taskList: row.task_list || [],
      remarks: row.remarks || '',
      paymentCount: parseInt(row.payment_count) || 0
    }));

    console.log(`在指定日期范围内找到 ${handoverRecords.length} 条交接班记录`);

    res.json({
      success: true,
      data: handoverRecords,
      message: `成功查询到 ${handoverRecords.length} 条交接班记录`
    });

  } catch (error) {
    console.error('按日期范围查询交接班记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '按日期范围查询交接班记录失败'
    });
  }
});

// 获取有交接记录的日期列表
router.get('/available-dates', async (req, res) => {
  try {
    console.log('开始查询可用的交接班日期');

    const sql = `
      SELECT date::text as date
      FROM handover
      WHERE payment_type IN (1, 2, 3, 4)
      GROUP BY date
      HAVING COUNT(DISTINCT payment_type) = 4
      ORDER BY date DESC
    `;

    const result = await query(sql);

    const availableDates = result.rows.map(row => row.date); // 现在date已经是字符串格式

    console.log(`找到 ${availableDates.length} 个有交接记录的日期`);

    res.json({
      success: true,
      data: availableDates,
      message: `找到 ${availableDates.length} 个有交接记录的日期`
    });

  } catch (error) {
    console.error('查询可用交接班日期失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '查询可用交接班日期失败'
    });
  }
});

// 完成交接班（保存完整数据并标记完成）
router.post('/complete', async (req, res) => {
  let client;

  try {
    console.log('收到完成交接班请求:', {
      body: JSON.stringify(req.body, null, 2),
      timestamp: new Date().toISOString()
    });

    const {
      date,
      handoverPerson,
      receivePerson,
      paymentData,
      vipCard,
      taskList,
      notes
    } = req.body;

    // 验证必需字段
    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的日期参数'
      });
    }

    if (!receivePerson || receivePerson.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '请输入接班人员姓名'
      });
    }

    if (!paymentData) {
      return res.status(400).json({
        success: false,
        message: '缺少支付数据'
      });
    }

    console.log('开始保存交接班数据到数据库');

    // 获取数据库连接并开启事务
    client = await getClient();
    await client.query('BEGIN');

    // 支付方式映射：前端字段名 -> 数据库代码
    const paymentTypeMapping = {
      '现金': 1,
      '微信': 2,
      '微邮付': 3,
      '其他': 4
    };

    // 定义要保存的支付方式
    const paymentMethods = ['现金', '微信', '微邮付', '其他'];

    // 保存结果数组
    const savedRecords = [];

    // 为每种支付方式保存一条记录
    for (const method of paymentMethods) {
      const sql = `
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

      // 提取当前支付方式的数据
      const values = [
        date,                                                      // $1: date
        handoverPerson || '系统',                                  // $2: handover_person
        receivePerson.trim(),                                     // $3: takeover_person
        method === '现金' ? (vipCard || 0) : 0,                   // $4: vip_card (只在现金记录中保存)
        paymentTypeMapping[method],                               // $5: payment_type
        paymentData.reserve?.[method] || 0,                       // $6: reserve_cash
        paymentData.hotelIncome?.[method] || 0,                   // $7: room_income
        paymentData.restIncome?.[method] || 0,                    // $8: rest_income
        paymentData.carRentIncome?.[method] || 0,                 // $9: rent_income
        paymentData.totalIncome?.[method] || 0,                   // $10: total_income
        paymentData.hotelDeposit?.[method] || 0,                  // $11: room_refund
        paymentData.restDeposit?.[method] || 0,                   // $12: rest_refund
        paymentData.retainedAmount?.[method] || 0,                // $13: retained
        paymentData.handoverAmount?.[method] || 0,                // $14: handover
        method === '现金' ? JSON.stringify(taskList || []) : '[]', // $15: task_list (只在现金记录中保存)
        method === '现金' ? (notes || '') : ''                    // $16: remarks (只在现金记录中保存)
      ];

      console.log(`保存 ${method} 支付方式的记录:`, {
        payment_type: paymentTypeMapping[method],
        handover_person: values[1],
        takeover_person: values[2]
      });

      const result = await client.query(sql, values);
      savedRecords.push(result.rows[0]);

      console.log(`${method} 记录保存成功，ID: ${result.rows[0].id}`);
    }

    // 提交事务
    await client.query('COMMIT');

    console.log('所有交接班记录保存成功，共保存', savedRecords.length, '条记录');

    // 准备响应数据
    const responseData = {
      success: true,
      message: '交接班完成，数据已保存',
      data: {
        date,
        handoverPerson: handoverPerson || '系统',
        receivePerson: receivePerson.trim(),
        recordCount: savedRecords.length,
        records: savedRecords
      }
    };

    res.json(responseData);

  } catch (error) {
    // 回滚事务
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log('事务已回滚');
      } catch (rollbackError) {
        console.error('回滚事务失败:', rollbackError);
      }
    }

    console.error('完成交接班失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '完成交接班失败',
      error: error.stack
    });
  } finally {
    // 释放数据库连接
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
