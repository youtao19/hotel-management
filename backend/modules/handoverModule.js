const { query, getClient } = require('../database/postgreDB/pg');

/**
 * 获取表格数据
 * @param {date} date - 查询日期
 * @returns {Promise<Object>} 交接班表格数据
 */
async function getShiftTable(date) {
  try{
    // 解析日期，并拿到前一天的日期
    const dateObj = new Date(date)
    const previousDate = new Date(dateObj)
    previousDate.setDate(dateObj.getDate() - 1)
    const previousDateStr = previousDate.toISOString().split('T')[0]

    // 创建对象
    const initPaywayBuckets = () => ({
      '现金': 0,
      '微信': 0,
      '微邮付': 0,
      '其他': 0,
    })

    const pay_ways = { 1:'现金', 2:'微信', 3:'微邮付', 4:'其他' }

    let reserve = initPaywayBuckets() // 备用金
    let hotelIncome = initPaywayBuckets() // 客房收入
    let restIncome = initPaywayBuckets() // 休息房收入
    let carRentIncome = initPaywayBuckets() // 租车收入
    let totalIncome = initPaywayBuckets() // 合计
    let hotelDeposit = initPaywayBuckets() // 客房退押
    let restDeposit = initPaywayBuckets() // 休息房退押
    let retainedAmount = initPaywayBuckets() // 留存款
    let handoverAmount = initPaywayBuckets() // 交接款

    // 使用备用金函数：某日备用金 = 前一日各支付方式交接款
    const reserveFromPrev = await getReserveCash(date)
    if (reserveFromPrev) {
      reserve = { ...reserve, ...reserveFromPrev }
    }

    const billSql = `
      SELECT bill_id, order_id, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date
      FROM bills
      WHERE stay_date::date = $1::date
      order by bill_id asc
    `;

    // 获取账单数据
    const billRes = await query(billSql, [previousDateStr])

    for (const row of billRes.rows) {
      const { pay_way, change_price, change_type, deposit, stay_type, room_fee } = row

      if (change_type === '订单账单'){
        if (stay_type === '客房'){
          hotelIncome[pay_way] += (Number(room_fee) + Number(deposit)) // 客房收入
        } else if (stay_type === '休息房'){
          restIncome[pay_way] += (Number(room_fee) + Number(deposit)) // 休息房收入
        }
      } else if (change_type === '退押'){
        if (stay_type === '客房'){
          hotelDeposit[pay_way] += Number(change_price) // 客房退押
        } else if (stay_type === '休息房'){
          restDeposit[pay_way] += Number(change_price) // 休息房退押
        }
      }
    }

    // 计算合计
    for (const method of Object.keys(totalIncome)) {
      totalIncome[method] = hotelIncome[method] + restIncome[method] + carRentIncome[method] + reserve[method]
      handoverAmount[method] = totalIncome[method] - hotelDeposit[method] - restDeposit[method] - retainedAmount[method]
    }

    // 现金留存款 320
    retainedAmount['现金'] = 320
    handoverAmount['现金'] -= 320

    return {
      reserve,
      hotelIncome,
      restIncome,
      carRentIncome,
      totalIncome,
      hotelDeposit,
      restDeposit,
      retainedAmount,
      handoverAmount
    }
  } catch (error) {
    console.error('获取交接班表格数据失败:', error);
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

  // Persist memo as plain text array only
  const textOnlyTaskList = Array.isArray(taskList)
    ? taskList.map(item => (typeof item === 'string' ? item : (item && item.title) ? item.title : String(item)))
    : [];

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
      JSON.stringify(textOnlyTaskList),
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
            JSON.stringify(textOnlyTaskList),
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
      JSON.stringify(textOnlyTaskList),
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
 * 获取已有交接班记录的日期列表（可访问日期）
 * @returns {Promise<string[]>}
 */
async function getAvailableDates() {
  const sql = `
    SELECT DISTINCT (date::date)::text AS date
    FROM handover
    WHERE payment_type IN (1,2,3,4)
    ORDER BY date ASC
  `;
  const result = await query(sql);
  return result.rows.map(r => r.date);
}

/**
 *
 * @param {*} dateStr
 * @returns
 */
function getPreviousDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day); // 本地时区
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * 开始交接班：若不存在则创建当天记录（使用默认数据初始化）
 * - 单日单条：存在则直接返回存在信息
 * - 首日或缺省：使用默认备用金与空字段
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<{created:boolean,id?:number,date:string}>}
 */
async function startHandover(handoverData) {
  // 使用单一客户端执行一个真正的事务，避免连接池下 BEGIN/COMMIT 分散到不同连接
  const client = await getClient();
  try {
    console.log('开始交接班操作，接收到数据:', JSON.stringify(handoverData, null, 2));

    await client.query('BEGIN');

    const {
      date,
      handoverPerson,
      receivePerson,
      notes,
      paymentData, // 新的数据结构：一个包含所有财务分类的对象
      vipCard
    } = handoverData;

    // 数据验证
    if (!date) {
      throw new Error('交接班日期不能为空');
    }

    if (!paymentData || typeof paymentData !== 'object') {
      throw new Error('支付数据格式不正确');
    }

    console.log('支付数据结构:', Object.keys(paymentData));

    // 确定交接日期，使用前一天的日期
    const handoverDate = getPreviousDateString(date);
    console.log('交接日期:', handoverDate, '（基于选择日期:', date, '）');

    // 支付方式文本到数据库代码的映射
    const pay_way_mapping = {
      '现金': 1,
      '微信': 2,
      '微邮付': 3,
      '其他': 4,
    };

    // 定义要遍历的支付方式（顺序执行，确保事务内串行提交，避免客户端并发查询）
    const paymentMethods = ['现金', '微信', '微邮付', '其他'];

    for (const method of paymentMethods) {
      console.log(`处理支付方式: ${method}`);

      // 验证 paymentData 是否包含所需的子对象
      const requiredFields = ['reserve', 'hotelIncome', 'restIncome', 'carRentIncome',
                             'totalIncome', 'hotelDeposit', 'restDeposit', 'retainedAmount', 'handoverAmount'];

      for (const field of requiredFields) {
        if (!paymentData[field] || typeof paymentData[field] !== 'object') {
          throw new Error(`支付数据中缺少或格式错误的字段: ${field}`);
        }
      }

      const sql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, vip_card, payment_type,
          reserve_cash, room_income, rest_income, rent_income, total_income,
          room_refund, rest_refund, retained, handover, remarks
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
          remarks = EXCLUDED.remarks
        RETURNING *;
      `;

      // 从 paymentData 对象中为当前支付方式提取数据，添加安全默认值
      const values = [
        handoverDate,
        handoverPerson || '',
        receivePerson || '',
        Number(vipCard) || 0,
        pay_way_mapping[method],
        Number(paymentData.reserve[method]) || 0,
        Number(paymentData.hotelIncome[method]) || 0,
        Number(paymentData.restIncome[method]) || 0,
        Number(paymentData.carRentIncome[method]) || 0,
        Number(paymentData.totalIncome[method]) || 0,
        Number(paymentData.hotelDeposit[method]) || 0, // 对应数据库的 room_refund
        Number(paymentData.restDeposit[method]) || 0,  // 对应数据库的 rest_refund
        Number(paymentData.retainedAmount[method]) || 0,
        Number(paymentData.handoverAmount[method]) || 0,
        notes || null,
      ];

      console.log(`${method} 的插入数据:`, values);

      const result = await client.query(sql, values);
      console.log(`${method} 插入/更新成功，ID:`, result.rows[0]?.id);
    }

    // 创建新的空的交接记录（次日，只有一条，payment_type=0）
    const nextDateObj = new Date(handoverDate);
    nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextDate = nextDateObj.toISOString().split('T')[0];

    console.log('准备创建次日空记录，日期:', nextDate);

    const emptyInsertSql = `
      INSERT INTO handover (
        date, handover_person, takeover_person, vip_card, payment_type,
        reserve_cash, room_income, rest_income, rent_income, total_income,
        room_refund, rest_refund, retained, handover, task_list, remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (date, payment_type) DO NOTHING;
    `;

    // 为所有16个参数准备值
    const emptyValues = [
      nextDate, // $1: date
      '',       // $2: handover_person
      '',       // $3: takeover_person
      0,        // $4: vip_card
      0,        // $5: payment_type=0, 代表空记录
      0,        // $6: reserve_cash
      0,        // $7: room_income
      0,        // $8: rest_income
      0,        // $9: rent_income
      0,        // $10: total_income
      0,        // $11: room_refund
      0,        // $12: rest_refund
      0,        // $13: retained
      0,        // $14: handover
      '[]',     // $15: task_list
      null      // $16: remarks
    ];

    // 只插入一条空记录（payment_type = 0）
    const emptyResult = await client.query(emptyInsertSql, emptyValues);
    console.log('次日空记录创建结果:', emptyResult.rowCount > 0 ? '成功' : '已存在，跳过');

    await client.query('COMMIT');
    console.log('交接班事务提交成功');

    return {
      success: true,
      created: true,
      date: handoverDate,
      message: '交接班数据保存成功'
    };

  } catch (error) {
    try {
      await client.query('ROLLBACK');
      console.log('事务已回滚');
    } catch(rollbackError) {
      console.error('回滚失败:', rollbackError);
    }

    console.error('交接班操作失败:', {
      message: error.message,
      stack: error.stack,
      inputData: JSON.stringify(handoverData, null, 2)
    });

    // 抛出更具体的错误信息
    if (error.code === '23505') { // 唯一约束违反
      throw new Error('该日期的交接班记录已存在');
    } else if (error.code === '23502') { // 非空约束违反
      throw new Error('缺少必填字段');
    } else if (error.code === '22P02') { // 数据类型错误
      throw new Error('数据格式错误');
    } else {
      throw new Error(`交接班操作失败: ${error.message}`);
    }
  } finally{
    client.release();
    console.log('数据库连接已释放');
  }
}

// 获取某日备用金（若不存在返回 null）
// 规则：某日备用金 = 前一日各支付方式的交接款 handover 之和
async function getReserveCash(date) {
  try {
    const previousDate = getPreviousDateString(date);

    const payWayMap = { 1: '现金', 2: '微信', 3: '微邮付', 4: '其他' };
    const buckets = { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 };

    const sql = `
      SELECT payment_type, COALESCE(SUM(handover), 0) AS amount
      FROM handover
      WHERE date = $1::date
        AND payment_type IN (1,2,3,4)
      GROUP BY payment_type
      ORDER BY payment_type
    `;
    const result = await query(sql, [previousDate]);

    if (result.rows.length === 0) {
      return null; // 没有记录
    }

    for (const row of result.rows) {
      const name = payWayMap[row.payment_type];
      if (name) {
        buckets[name] = Number(row.amount || 0);
      }
    }

    return buckets;
  } catch (error) {
    console.error('获取备用金失败:', error);
    throw error;
  }
}

/**
 * 从 handover 表读取指定日期的聚合数据（按支付方式），用于页面直接展示
 * 若该日期无真实支付类型记录（1/2/3/4），返回 null
 * 返回结构与 getShiftTable 一致的 paymentData 结构
 */
async function getHandoverAggregatedByDate(date) {
  try {
    const payWayMap = { 1: '现金', 2: '微信', 3: '微邮付', 4: '其他' };
    const initBuckets = () => ({ '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 });

    let reserve = initBuckets();
    let hotelIncome = initBuckets();
    let restIncome = initBuckets();
    let carRentIncome = initBuckets();
    let totalIncome = initBuckets();
    let hotelDeposit = initBuckets();
    let restDeposit = initBuckets();
    let retainedAmount = initBuckets();
    let handoverAmount = initBuckets();

    const sql = `
      SELECT payment_type,
             COALESCE(SUM(reserve_cash), 0) AS reserve_cash,
             COALESCE(SUM(room_income), 0)   AS room_income,
             COALESCE(SUM(rest_income), 0)   AS rest_income,
             COALESCE(SUM(rent_income), 0)   AS rent_income,
             COALESCE(SUM(total_income), 0)  AS total_income,
             COALESCE(SUM(room_refund), 0)   AS room_refund,
             COALESCE(SUM(rest_refund), 0)   AS rest_refund,
             COALESCE(SUM(retained), 0)      AS retained,
             COALESCE(SUM(handover), 0)      AS handover
      FROM handover
      WHERE date = $1::date AND payment_type IN (1,2,3,4)
      GROUP BY payment_type
      ORDER BY payment_type
    `;
    const result = await query(sql, [date]);

    if (result.rows.length === 0) return null;

    for (const row of result.rows) {
      const name = payWayMap[row.payment_type];
      if (!name) continue;
      reserve[name]        = Number(row.reserve_cash || 0);
      hotelIncome[name]    = Number(row.room_income || 0);
      restIncome[name]     = Number(row.rest_income || 0);
      carRentIncome[name]  = Number(row.rent_income || 0);
      totalIncome[name]    = Number(row.total_income || 0);
      hotelDeposit[name]   = Number(row.room_refund || 0);
      restDeposit[name]    = Number(row.rest_refund || 0);
      retainedAmount[name] = Number(row.retained || 0);
      handoverAmount[name] = Number(row.handover || 0);
    }

    return {
      reserve,
      hotelIncome,
      restIncome,
      carRentIncome,
      totalIncome,
      hotelDeposit,
      restDeposit,
      retainedAmount,
      handoverAmount
    };
  } catch (error) {
    console.error('读取交接班聚合数据失败:', error);
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

module.exports = {
  getShiftTable,
  saveAmountChanges,
  getRemarks,
  getAvailableDates,
  startHandover,
  getReserveCash,
  getShiftSpecialStats,
  getHandoverAggregatedByDate
};
