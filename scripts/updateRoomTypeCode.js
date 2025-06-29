const { query } = require('../backend/database/postgreDB/pg');

async function updateRoomType() {
  try {
    console.log('开始更新阿苏晓筑的type_code...');

    // 1. 先检查现有房型
    const checkResult = await query("SELECT * FROM room_types WHERE type_name = '阿苏晓筑'");

    if (checkResult.rows.length === 0) {
      console.error('未找到阿苏晓筑房型！');
      process.exit(1);
    }

    console.log('当前房型信息:');
    console.table(checkResult.rows);

    // 2. 先保存旧的type_code和其他信息
    const oldTypeCode = checkResult.rows[0].type_code;
    const typeInfo = checkResult.rows[0];

    // 3. 先创建新的房型记录
    console.log('\n开始创建新的房型记录...');
    await query(
      "INSERT INTO room_types (type_code, type_name, base_price, description, is_closed) VALUES ($1, $2, $3, $4, $5)",
      ['asu_xiao_zhu', '阿苏晓筑', typeInfo.base_price, typeInfo.description, typeInfo.is_closed]
    );

    console.log('新房型记录创建成功！');

    // 4. 更新房间表中的引用
    console.log('\n开始更新房间表中的引用...');
    const updateRoomsResult = await query(
      "UPDATE rooms SET type_code = $1 WHERE type_code = $2",
      ['asu_xiao_zhu', oldTypeCode]
    );

    console.log(`房间表更新成功！更新了 ${updateRoomsResult.rowCount} 个房间`);

    // 5. 删除旧的房型记录
    console.log('\n开始删除旧的房型记录...');
    await query("DELETE FROM room_types WHERE type_code = $1", [oldTypeCode]);

    console.log('旧房型记录删除成功！');

    console.log(`更新成功！更新了 ${updateRoomsResult.rowCount} 个房间`);

    // 4. 验证更新结果
    const verifyResult = await query("SELECT * FROM room_types WHERE type_name = '阿苏晓筑'");
    console.log('\n更新后的房型信息:');
    console.table(verifyResult.rows);

    const roomsResult = await query(
      "SELECT room_number, type_code, price FROM rooms WHERE type_code = 'asu_xiao_zhu'"
    );
    console.log('\n更新后的房间信息:');
    console.table(roomsResult.rows);

    console.log('房型code更新完成！');
    process.exit(0);
  } catch (err) {
    console.error('更新过程中发生错误:', err);
    process.exit(1);
  }
}

updateRoomType();
