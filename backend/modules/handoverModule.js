const { query } = require('../database/postgreDB/pg');

// 运行时探测 handover.task_list 列类型（JSONB 或 TEXT[]），并缓存结果
let handoverTaskListIsJsonb = null;
async function ensureHandoverTaskListType() {
  if (handoverTaskListIsJsonb !== null) return handoverTaskListIsJsonb;
  try {
    const res = await query(
      `SELECT data_type, udt_name
       FROM information_schema.columns
       WHERE table_name = 'handover' AND column_name = 'task_list'
       LIMIT 1`
    );
    const row = res.rows?.[0];
    // information_schema 对 text[] 通常为 data_type = 'ARRAY'，udt_name = '_text'
    // 对 jsonb 为 data_type = 'jsonb'
    handoverTaskListIsJsonb = row?.data_type === 'jsonb';
  } catch (e) {
    // 若查询失败，默认按 JSONB 处理（与最新表结构一致）
    handoverTaskListIsJsonb = true;
  }
  return handoverTaskListIsJsonb;
}


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

    // 创建五个对象
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

    const reserveSql = `
      SELECT date, handover, payment_type
      FROM handover
      WHERE date = $1::date
      order by id asc
    `;
    // 获取备用金数据
    const reserveRes = await query(reserveSql, [previousDateStr])
    for (const row of reserveRes.rows) {
      const { handover, payment_type } = row
      reserve[pay_ways[payment_type]] += Number(handover)
    }

    const billSql = `
      SELECT bill_id, order_id, pay_way, change_price, change_type, deposit, stay_type, room_fee, stay_date
      FROM bills
      WHERE stay_date::date = $1::date
      order by bill_id asc
    `;

    // 获取账单数据
    const billRes = await query(billSql, [date])

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
  const sql = `SELECT (shift_date::date)::text AS date FROM shift_handover ORDER BY shift_date ASC`;
  const result = await query(sql);
  return result.rows.map(r => r.date);
}

/**
 * 开始交接班：若不存在则创建当天记录（使用默认数据初始化）
 * - 单日单条：存在则直接返回存在信息
 * - 首日或缺省：使用默认备用金与空字段
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<{created:boolean,id?:number,date:string}>}
 */
async function startHandover(handoverData) {
  // 最佳实践：在生产环境中，以下所有数据库操作应包裹在一个事务中
  // (BEGIN -> COMMIT/ROLLBACK) 来确保数据原子性。
  try {
    await query('BEGIN');
    const {
      date,
      handoverPerson,
      receivePerson,
      notes,
      taskList,
      paymentData, // 新的数据结构：一个包含所有财务分类的对象
      vipCard
    } = handoverData;

    // 确定交接日期，使用前一天的日期
    const t = new Date(date)
    if (isNaN(t.getTime())) {
      console.error('交接日期错误:', date, '使用当前日期:', new Date().toISOString().split('T')[0]);
      throw new Error('交接日期错误');
    }
    t.setDate(t.getDate() - 1)
    const handoverDate = t.toISOString().split('T')[0]

    // 支付方式文本到数据库代码的映射
    const pay_way_mapping = {
      '现金': 1,
      '微信': 2,
      '微邮付': 3,
      '其他': 4,
    };

    // 定义要遍历的支付方式
    const paymentMethods = ['现金', '微信', '微邮付', '其他'];

    // 任务列表（作为 JSONB 保存，保留结构，最少包含字符串 title）
    const taskListJsonArray = Array.isArray(taskList)
      ? taskList.map(item => {
          if (typeof item === 'string') return { title: item };
          if (item && typeof item === 'object') {
            // 统一字段：title / task -> title, completed/done -> completed
            const title = (item.title || item.task || '').toString();
            const completed = Boolean(
              item.completed !== undefined ? item.completed : item.done
            );
            const id = item.id ?? null;
            const time = item.time ?? null;
            return { id, title, completed, time };
          }
          return { title: String(item) };
        })
      : [];

    // 为每种支付方式创建一个插入数据库的Promise
    const isJsonb = await ensureHandoverTaskListType();
    const insertPromises = paymentMethods.map(method => {
      const sql = `
        INSERT INTO handover (
          date, handover_person, takeover_person, vip_card, payment_type,
          reserve_cash, room_income, rest_income, rent_income, total_income,
          room_refund, rest_refund, retained, handover, task_list, remarks
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, ${isJsonb ? '$15::jsonb' : '$15'}, $16)
        RETURNING *;
      `;

      // 从 paymentData 对象中为当前支付方式提取数据
      const values = [
        handoverDate,
        handoverPerson || '',
        receivePerson || '',
        vipCard || 0,
        pay_way_mapping[method],
        paymentData.reserve[method] || 0,
        paymentData.hotelIncome[method] || 0,
        paymentData.restIncome[method] || 0,
        paymentData.carRentIncome[method] || 0,
        paymentData.totalIncome[method] || 0,
        paymentData.hotelDeposit[method] || 0, // 对应数据库的 room_refund
        paymentData.restDeposit[method] || 0,  // 对应数据库的 rest_refund
        paymentData.retainedAmount[method] || 0,
        paymentData.handoverAmount[method] || 0,
        isJsonb ? JSON.stringify(taskListJsonArray) : taskListJsonArray.map(t => t.title || ''),
        notes,
      ];

      // 假设 'query' 是一个可用的数据库查询函数
      return query(sql, values).then(result => result.rows[0]);
    });


    // 并发执行所有插入操作
    try{
      const insertedRows = await Promise.all(insertPromises);
      console.log(`成功插入 ${insertedRows.length} 条交接班记录。`);
    } catch (error) {
      console.error('插入交接班记录失败:', error);
      throw error;
    }


    // 创建新的空的交接记录（次日，每种支付方式各一条，金额置零）
    const nextDate = new Date().toISOString().split('T')[0]
    const emptyInsertSql = `
      INSERT INTO handover (
        date, handover_person, takeover_person, vip_card, payment_type,
        reserve_cash, room_income, rest_income, rent_income, total_income,
        room_refund, rest_refund, retained, handover, task_list, remarks
      )
      VALUES ($1,$2,$3,$4,$5, 0,0,0,0,0, 0,0,0,0, ${isJsonb ? '$6::jsonb' : '$6'}, $7)
      RETURNING id;
    `
    const emptyTaskList = isJsonb ? JSON.stringify([]) : []
    const emptyRemarks = null
    const emptyPromises = paymentMethods.map(method =>
      query(emptyInsertSql, [
        nextDate,
        '',   // handover_person 非空以满足 NOT NULL
        '',   // takeover_person 非空以满足 NOT NULL
        0,    // vip_card
        pay_way_mapping[method],
        emptyTaskList,
        emptyRemarks
      ])
    )
    try {
      await Promise.all(emptyPromises)
      console.log('创建新的空的交接记录成功')
    } catch (error) {
      console.error('创建新的空的交接记录失败:', error)
      throw error
    }

    await query('COMMIT');

    return { created: true, date: handoverDate };

  } catch (error) {
    await query('ROLLBACK');
    console.error('交接班失败:', error);
    // 在实际的事务处理中，这里应该执行 ROLLBACK
    throw error;
  } finally{
    // no-op
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
  getShiftSpecialStats
};
