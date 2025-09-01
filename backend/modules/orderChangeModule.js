"use strict";

const { query } = require('../database/postgreDB/pg');
const orderModule = require('./orderModule');

/**
 * 记录订单修改历史
 * @param {string} orderId - 订单ID
 * @param {string} changeType - 变更类型
 * @param {object} oldValue - 修改前值
 * @param {object} newValue - 修改后值
 * @param {string[]} changedFields - 变更字段数组
 * @param {string} [reason] - 变更原因
 * @param {string} [operator] - 操作人
 * @returns {Promise<object>} - 返回变更记录
 */
async function recordOrderChange(orderId, changeType, oldValue, newValue, changedFields, reason = null, operator = null) {
  try {
    const insertSql = `
      INSERT INTO order_changes (
        order_id,
        change_type,
        old_value,
        new_value,
        changed_fields,
        change_reason,
        operator,
        change_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const result = await query(insertSql, [
      orderId,
      changeType,
      JSON.stringify(oldValue),
      JSON.stringify(newValue),
      changedFields,
      reason,
      operator
    ]);

    console.log(`✅ 已记录订单 ${orderId} 的修改历史，变更ID: ${result.rows[0].change_id}`);
    return result.rows[0];
  } catch (error) {
    console.error('记录订单修改历史失败:', error);
    throw error;
  }
}

/**
 * 修改订单
 * @param {string} orderId - 订单ID
 * @param {object} updateData - 要更新的数据
 * @param {string} [reason] - 修改原因
 * @param {string} [operator] - 操作人
 * @returns {Promise<object>} - 返回修改后的订单
 */
/**
 * 批量记录订单变更
 * @param {string} orderId - 订单ID
 * @param {object} oldOrder - 原订单数据
 * @param {object} newOrder - 新订单数据
 * @param {string[]} changedFields - 变更字段列表
 * @param {object} validFields - 字段中文名映射
 * @param {string} reason - 变更原因
 * @param {string} operator - 操作人
 * @param {object} client - 数据库客户端
 * @returns {Promise<void>}
 */
async function batchRecordOrderChanges(orderId, oldOrder, newOrder, changedFields, validFields, reason, operator, client) {
  // 性能优化：如果变更字段太多，可能会造成数据库插入压力
  // 一次性插入变更记录，而不是每个字段单独插入
  const MAX_FIELDS_PER_RECORD = 10; // 每个变更记录最多包含的字段数
  const sanitizeForLog = (obj) => JSON.parse(JSON.stringify(obj));

  if (changedFields.length <= MAX_FIELDS_PER_RECORD) {
    // 字段数量适中，一次性记录所有变更
    let changeType = '多字段修改';
    if (changedFields.length === 1) {
      // 单字段修改，使用字段中文名作为变更类型
      changeType = `修改${validFields[changedFields[0]] || changedFields[0]}`;
    }

    // 使用事务中的client而不是全局query
    const insertSql = `
      INSERT INTO order_changes (
        order_id,
        change_type,
        old_value,
        new_value,
        changed_fields,
        change_reason,
        operator,
        change_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING change_id
    `;

    await client.query(insertSql, [
      orderId,
      changeType,
      JSON.stringify(sanitizeForLog(oldOrder)),
      JSON.stringify(sanitizeForLog(newOrder)),
      changedFields,
      reason,
      operator
    ]);

  } else {
    // 字段数量过多，分批记录变更
    console.log(`⚠️ 订单 ${orderId} 变更字段过多(${changedFields.length}个)，将分批记录变更历史`);

    // 将字段按照关联性分组，最多每组MAX_FIELDS_PER_RECORD个字段
    const fieldGroups = [];
    for (let i = 0; i < changedFields.length; i += MAX_FIELDS_PER_RECORD) {
      fieldGroups.push(changedFields.slice(i, i + MAX_FIELDS_PER_RECORD));
    }

    // 为每组字段创建一条变更记录
    for (let i = 0; i < fieldGroups.length; i++) {
      const groupFields = fieldGroups[i];

      // 创建这一组字段的变更记录
      const changeType = `批量修改(${i+1}/${fieldGroups.length})`;

      // 只包含这一组字段的新旧值对象
      const groupOldValues = {};
      const groupNewValues = {};

      groupFields.forEach(field => {
        groupOldValues[field] = oldOrder[field];
        groupNewValues[field] = newOrder[field];
      });

      // 使用事务中的client而不是全局query
      const insertSql = `
        INSERT INTO order_changes (
          order_id,
          change_type,
          old_value,
          new_value,
          changed_fields,
          change_reason,
          operator,
          change_time
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING change_id
      `;

      await client.query(insertSql, [
        orderId,
        changeType,
        JSON.stringify(sanitizeForLog(groupOldValues)),
        JSON.stringify(sanitizeForLog(groupNewValues)),
        groupFields,
        reason,
        operator
      ]);
    }
  }
}

/**
 * 修改订单
 * @param {string} orderId - 订单ID
 * @param {object} updateData - 要更新的数据
 * @param {string} [reason] - 修改原因
 * @param {string} [operator] - 操作人
 * @returns {Promise<object>} - 返回修改后的订单
 */
async function updateOrder(orderId, updateData, reason = null, operator = null) {
  const client = await require('../database/postgreDB/pg').getClient();
  try {
    await client.query('BEGIN');
    // 仅对本事务设置语句超时，避免长时间阻塞
    await client.query("SET LOCAL statement_timeout = '8000ms'");

    // 1) 加锁读取原订单
    console.time(`获取订单${orderId}信息`);
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE order_id = $1 FOR UPDATE',
      [orderId]
    );
    console.timeEnd(`获取订单${orderId}信息`);

    if (orderResult.rows.length === 0) {
      throw { code: 'ORDER_NOT_FOUND', message: '订单不存在' };
    }
    const oldOrder = orderResult.rows[0];

    // 2) 构建变更
    console.time(`分析订单${orderId}变更字段`);
    const updateFields = [];
    const updateValues = [];
    const changedFields = [];

    const protectedFields = ['order_id', 'create_time', 'show'];
    const validFields = {
      guest_name: '客人姓名',
      phone: '联系电话',
      id_number: '证件号码',
      room_type: '房间类型',
      room_number: '房间号',
      check_in_date: '入住日期',
      check_out_date: '退房日期',
      status: '订单状态',
      payment_method: '支付方式',
      room_price: '房间价格',
      deposit: '押金',
      remarks: '备注',
      order_source: '订单来源',
      id_source: '来源单号',
      check_in_time: '入住时间',
      check_out_time: '退房时间',
      should_pay: '应付金额',
      paid_amount: '已付金额',
      pay_way: '支付方式',
      order_status: '订单状态',
      discount: '折扣',
      refund_deposit: '退押金',
      refund_time: '退款时间',
      refund_method: '退款方式',
      refund_amount: '退款金额',
      days: '天数',
      is_company: '是否企业客户',
      company_name: '公司名称',
      room_rate: '房价',
      arrival_time: '到达时间',
      stay_type: '住宿类型',
      gender: '性别',
      source: '来源',
      id_card: '证件号'
    };

    let paramCounter = 1;
    for (const [key, value] of Object.entries(updateData)) {
      if (protectedFields.includes(key)) continue;

      let hasChanged = false;
      if (oldOrder[key] === undefined && value !== undefined) {
        hasChanged = true;
      } else if (typeof oldOrder[key] === 'object' || typeof value === 'object') {
        if (key === 'room_price' && typeof value === 'object' && value !== null) {
          hasChanged = JSON.stringify(oldOrder[key]) !== JSON.stringify(value);
        } else if (oldOrder[key] instanceof Date && value instanceof Date) {
          hasChanged = oldOrder[key].getTime() !== value.getTime();
        } else {
          hasChanged = JSON.stringify(oldOrder[key]) !== JSON.stringify(value);
        }
      } else {
        hasChanged = oldOrder[key] != value; // 非严格比较，兼容数值/字符串
      }

      if (hasChanged && Object.prototype.hasOwnProperty.call(validFields, key)) {
        updateFields.push(`${key} = $${paramCounter}`);
        updateValues.push(value);
        changedFields.push(key);
        paramCounter++;
      }
    }
    console.timeEnd(`分析订单${orderId}变更字段`);

    // 无变更则直接返回
    if (changedFields.length === 0) {
      await client.query('COMMIT');
      return oldOrder;
    }

    // 3) 执行更新
    console.time(`更新订单${orderId}`);
    const updateQuery = `
      UPDATE orders
      SET ${updateFields.join(', ')}
      WHERE order_id = $${paramCounter}
      RETURNING *
    `;
    updateValues.push(orderId);
    const updateResult = await client.query(updateQuery, updateValues);
    const newOrder = updateResult.rows[0];
    console.timeEnd(`更新订单${orderId}`);

    // 4) 记录变更历史
    console.time(`记录订单${orderId}变更历史`);
    await batchRecordOrderChanges(
      orderId,
      oldOrder,
      newOrder,
      changedFields,
      validFields,
      reason,
      operator,
      client
    );
    console.timeEnd(`记录订单${orderId}变更历史`);

    // 5) 提交
    await client.query('COMMIT');
    return newOrder;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('修改订单失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 获取订单修改历史
 * @param {string} orderId - 订单ID
 * @returns {Promise<Array>} - 返回修改历史记录
 */
async function getOrderChangeHistory(orderId) {
  try {
    const result = await query(
      `SELECT * FROM order_changes
       WHERE order_id = $1
       ORDER BY change_time DESC`,
      [orderId]
    );

    return result.rows;
  } catch (error) {
    console.error('获取订单修改历史失败:', error);
    throw error;
  }
}

/**
 * 获取特定时间范围内的所有订单修改历史
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @returns {Promise<Array>} - 返回修改历史记录
 */
async function getAllOrderChangesInRange(startDate, endDate) {
  try {
    const result = await query(
      `SELECT oc.*, o.guest_name, o.room_number, o.room_type
       FROM order_changes oc
       JOIN orders o ON oc.order_id = o.order_id
       WHERE oc.change_time BETWEEN $1 AND $2
       ORDER BY oc.change_time DESC`,
      [startDate, endDate]
    );

    return result.rows;
  } catch (error) {
    console.error('获取时间范围内的订单修改历史失败:', error);
    throw error;
  }
}

module.exports = {
  recordOrderChange,
  updateOrder,
  getOrderChangeHistory,
  getAllOrderChangesInRange
};
