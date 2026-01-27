// e2e/global-setup.js
const db = require('../backend/database/postgreDB/pg');
const { roomTypes, rooms, addRoomType, addRoom } = require('../backend/tests/tools');

module.exports = async () => {
  // 初始化测试连接池和表结构
  await db.initializePostgreDB();

  // 写入基础房型与房间数据（忽略重复数据错误）
  try {
    await addRoomType(roomTypes);
  } catch (error) {
    // 如果是主键冲突错误，忽略它（数据已存在）
    if (error.code !== '23505') {
      throw error;
    }
    console.log('房型数据已存在，跳过插入');
  }

  try {
    await addRoom(rooms);
  } catch (error) {
    // 如果是主键冲突错误，忽略它（数据已存在）
    if (error.code !== '23505') {
      throw error;
    }
    console.log('房间数据已存在，跳过插入');
  }
};
