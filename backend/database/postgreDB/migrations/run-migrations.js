// 执行所有数据库迁移
"use strict";

const { createPool } = require('../pg');
const addIsClosedToRooms = require('./add_is_closed_to_rooms');
const removeActualTimesFromOrders = require('./remove_actual_times_from_orders');
const addRefundFieldsToOrders = require('./add_refund_fields_to_orders');

/**
 * 执行所有迁移
 */
async function runMigrations() {
  try {
    console.log('初始化数据库连接...');
    createPool();

    console.log('开始执行迁移...');

    // 执行所有迁移
    await addIsClosedToRooms.migrate();
    await removeActualTimesFromOrders.migrate();
    await addRefundFieldsToOrders.migrate();

    console.log('所有迁移执行完成');
    process.exit(0);
  } catch (error) {
    console.error('迁移执行失败:', error);
    process.exit(1);
  }
}

// 执行迁移
runMigrations();
