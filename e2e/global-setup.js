// e2e/global-setup.js
const db = require('../backend/database/postgreDB/pg');
const { roomTypes, rooms, addRoomType, addRoom } = require('../backend/tests/tools');

module.exports = async () => {
  // 初始化测试连接池和表结构
  await db.initializePostgreDB();

  // 写入基础房型与房间数据
  await addRoomType(roomTypes);
  await addRoom(rooms);
};
