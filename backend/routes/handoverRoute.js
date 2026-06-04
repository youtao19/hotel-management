const express =  require('express');
const router = express.Router();
const { query, getClient } = require('../database/postgreDB/pg');
const db = require("../database/postgreDB/pg")
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const ajv = new Ajv({ allErrors: true, removeAdditional: "failing", coerceTypes: true });
addFormats(ajv);

const PAYMENT_METHODS = ["现金", "微信", "微邮付", "其他"];

const formatAjvErrors = (errors = []) => {
  return errors.map((error) => {
    const path = error.instancePath ? error.instancePath.replace(/^\//, "") : "";
    const field = path || error.params?.missingProperty || "";
    return {
      field,
      message: error.message
    };
  });
};

const createPaymentBucketSchema = () => {
  return {
    type: "object",
    properties: PAYMENT_METHODS.reduce((acc, method) => {
      acc[method] = { type: "number" };
      return acc;
    }, {}),
    required: PAYMENT_METHODS,
    additionalProperties: false
  };
};

const paymentBucketSchema = createPaymentBucketSchema();

const requiredDateQuerySchema = {
  type: "object",
  properties: {
    date: { type: "string", format: "date" }
  },
  required: ["date"],
  additionalProperties: false
};

const completeHandoverSchema = {
  type: "object",
  properties: {
    date: { type: "string", format: "date" },
    handoverPerson: { type: "string", minLength: 1, maxLength: 100 },
    receivePerson: { type: "string", minLength: 1, maxLength: 100 },
    retainedAmount: paymentBucketSchema,
    vipCard: { type: "number", minimum: 0 },
    notes: { type: "string", maxLength: 2000 }
  },
  required: ["date", "receivePerson"],
  additionalProperties: false
};

const validateRequiredDateQuery = ajv.compile(requiredDateQuerySchema);
const validateCompleteHandover = ajv.compile(completeHandoverSchema);

/**
 * 清洗查询参数，去掉字符串值首尾空格
 * @param {Record<string, unknown>} query 原始查询对象（默认空对象）
 * @returns {Record<string, unknown>} 去除空格后的新对象
 */
const sanitizeQuery = (query = {}) => {
  return Object.keys(query).reduce((acc, key) => {
    const value = query[key];
    if (typeof value === "string") {
      acc[key] = value.trim();
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const {
  getHandoverTableData,
  getHandoverOverview,
  recalculatePaymentData,
  getAdminMemosFromHandover,
} = require('../modules/handoverModule');


router.get('/overview', async (req, res) => {
  try {
    const queryData = sanitizeQuery(req.query);
    const isValid = validateRequiredDateQuery(queryData);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "缺少必需的日期参数",
        errors: formatAjvErrors(validateRequiredDateQuery.errors)
      });
    }

    const data = await getHandoverOverview({
      date: queryData.date,
      account: req.session?.account
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching handover overview:', error);
    return res.status(500).json({ success: false, message: error.message || '获取交接班数据失败' });
  }
});

// 获取交接班表格数据（从handover表查询）
router.get('/handover-table', async (req, res) => {
  try {
    const queryData = sanitizeQuery(req.query);
    const isValid = validateRequiredDateQuery(queryData);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "缺少必需的日期参数",
        errors: formatAjvErrors(validateRequiredDateQuery.errors)
      });
    }

    const { date } = queryData;
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

// 获取交接班页面特殊统计（开房数、休息房数、好评邀/得）
router.get('/special-stats', async (req, res) => {
  try {
    const queryData = sanitizeQuery(req.query);
    const isValid = validateRequiredDateQuery(queryData);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "缺少必需的日期参数",
        errors: formatAjvErrors(validateRequiredDateQuery.errors)
      });
    }
    const { date } = queryData;

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

    const roomResult = await db.query(roomSql, [date]);

    // 统计好评邀请/得到数量 - 使用正确的字段名
    const reviewSql = `
      SELECT
        COUNT(*) AS invited,
        COUNT(*) FILTER (WHERE positive_review = true) AS positive
      FROM review_invitations
      WHERE invite_time::date = $1::date
    `;

    const reviewResult = await db.query(reviewSql, [date]);

    const data = {
      openCount: parseInt(roomResult.rows[0].open_count) || 0,
      restCount: parseInt(roomResult.rows[0].rest_count) || 0,
      invited: parseInt(reviewResult.rows[0].invited) || 0,
      positive: parseInt(reviewResult.rows[0].positive) || 0
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('获取交接班特殊统计失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取交接班表中的管理员备忘录
router.get('/admin-memos', async (req, res) => {

  try {
    const queryData = sanitizeQuery(req.query);
    const isValid = validateRequiredDateQuery(queryData);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "缺少必需的日期参数",
        errors: formatAjvErrors(validateRequiredDateQuery.errors)
      });
    }
    const { date } = queryData;

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

// 完成交接班（优化版）
router.post('/complete', async (req, res) => {
  let client;

  try {
    // ✅ 使用 AJV 自动校验与类型清洗
    const isValid = validateCompleteHandover(req.body);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: '请求数据格式错误',
        errors: formatAjvErrors(validateCompleteHandover.errors)
      });
    }

    // Ajv 已清洗类型
    const {
      date,
      handoverPerson,
      receivePerson,
      retainedAmount,
      vipCard = 0,
      notes = ''
    } = req.body;
    const operatorName = handoverPerson
      || req.session?.account?.username
      || req.session?.account?.name
      || req.session?.account?.email
      || '系统';

	    console.log('收到完成交接班请求:', {
	      date, handoverPerson: operatorName, receivePerson,
	      vipCard, timestamp: new Date().toLocaleString('zh-CN', { hour12: false })
	    });

    const overview = await getHandoverOverview({
      date,
      account: req.session?.account
    });
    const paymentData = recalculatePaymentData(overview.paymentData, { retainedAmount });

    client = await getClient();
    await client.query('BEGIN');

    const paymentTypeMapping = { '现金': 1, '微信': 2, '微邮付': 3, '其他': 4 };

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

    // ✅ 并行保存四种支付方式记录
    const results = await Promise.all(
      PAYMENT_METHODS.map(method => {
        const values = [
          date,
          operatorName,
          receivePerson.trim(),
          method === '现金' ? vipCard : 0,
          paymentTypeMapping[method],
          paymentData.reserve?.[method] || 0,
          paymentData.hotelIncome?.[method] || 0,
          paymentData.restIncome?.[method] || 0,
          paymentData.carRentIncome?.[method] || 0,
          paymentData.totalIncome?.[method] || 0,
          paymentData.hotelDeposit?.[method] || 0,
          paymentData.restDeposit?.[method] || 0,
          paymentData.retainedAmount?.[method] || 0,
          paymentData.handoverAmount?.[method] || 0,
          '[]',
          method === '现金' ? (notes || '') : ''
        ];
        return client.query(insertSQL, values);
      })
    );

    await client.query('COMMIT');

    const savedRecords = results.flatMap(r => r.rows);
    console.log('交接班记录保存完成，共', savedRecords.length, '条');

    res.json({
      success: true,
      message: '交接班完成，数据已保存',
      data: {
        date,
        handoverPerson: operatorName,
        receivePerson: receivePerson.trim(),
        recordCount: savedRecords.length,
        records: savedRecords
      }
    });

  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.warn('事务已回滚');
      } catch (rollbackError) {
        console.error('回滚事务失败:', rollbackError);
      }
    }

    console.error('完成交接班失败:', {
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: error.message || '完成交接班失败'
    });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
