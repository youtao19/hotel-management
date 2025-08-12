"use strict";

const { query } = require("../backend/database/postgreDB/pg");
const billTable = require("../backend/database/postgreDB/tables/bill");

(async () => {
  try {
    console.log("开始更新 bills 表结构...");

    // 删除旧表（如果需要）
    await query(billTable.dropQuery);
    console.log("旧表已删除。");

    // 创建新表
    await query(billTable.createQuery);
    console.log("新表已创建。");

    // 创建索引
    for (const indexQuery of billTable.createIndexQueryStrings) {
      await query(indexQuery);
      console.log(`索引已创建: ${indexQuery}`);
    }

    console.log("bills 表结构更新完成！");
  } catch (error) {
    console.error("更新 bills 表结构时出错:", error);
  } finally {
    process.exit();
  }
})();
