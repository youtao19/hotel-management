const db = require('../backend/database/postgreDB/pg');

const roomTypes = [
  {
    type_code: "asu_xiao_zhu",
    type_name: "阿苏晓筑",
    base_price: 288.00,
    description: "舒适的日式风格房间，温馨宁静",
    is_closed: false
  },
  {
    type_code: "bo_ye_shuang",
    type_name: "泊野双床",
    base_price: 258.00,
    description: "双床配置，适合朋友或同事入住",
    is_closed: false
  },
  {
    type_code: "nuan_ju_jiating",
    type_name: "暖居家庭房",
    base_price: 368.00,
    description: "温馨家庭房，适合全家出行",
    is_closed: false
  },
  {
    type_code: "sheng_sheng_man",
    type_name: "声声慢投影大床",
    base_price: 348.00,
    description: "配备投影设备的大床房，适合观影休闲",
    is_closed: false
  },
  {
    type_code: "xing_yun_ge",
    type_name: "行云阁",
    base_price: 388.00,
    description: "带有私人院子的特色房型，闹中取静",
    is_closed: false
  },
  {
    type_code: "yi_jiang_nan",
    type_name: "忆江南大床房",
    base_price: 268.00,
    description: "江南风格装修的大床房，典雅舒适",
    is_closed: false
  },
  {
    type_code: "you_ge_yuan_zi",
    type_name: "有个院子",
    base_price: 130.00,
    description: null,
    is_closed: false
  },
  {
    type_code: "yun_ju_ying_yin",
    type_name: "云居云端影音房",
    base_price: 428.00,
    description: "顶级影音设备配置，享受云端视听体验",
    is_closed: false
  },
  {
    type_code: "zui_shan_tang",
    type_name: "醉山塘",
    base_price: 398.00,
    description: "山塘街风格装修，体验古典江南韵味",
    is_closed: false
  }
];

const rooms = [
  { room_number: "201", type_code: "sheng_sheng_man", status: "available", price: 348.00, is_closed: false },
  { room_number: "202", type_code: "bo_ye_shuang", status: "available", price: 258.00, is_closed: false },
  { room_number: "111", type_code: "asu_xiao_zhu", status: "available", price: 288.00, is_closed: false },
  { room_number: "113", type_code: "you_ge_yuan_zi", status: "cleaning", price: 388.00, is_closed: false },
  { room_number: "115", type_code: "you_ge_yuan_zi", status: "available", price: 388.00, is_closed: false },
  { room_number: "117", type_code: "you_ge_yuan_zi", status: "available", price: 388.00, is_closed: false },
  { room_number: "211", type_code: "yi_jiang_nan", status: "cleaning", price: 268.00, is_closed: false },
  { room_number: "311", type_code: "yi_jiang_nan", status: "available", price: 268.00, is_closed: false },
  { room_number: "312", type_code: "yi_jiang_nan", status: "available", price: 268.00, is_closed: false },
  { room_number: "307", type_code: "bo_ye_shuang", status: "available", price: 258.00, is_closed: false },
  { room_number: "308", type_code: "bo_ye_shuang", status: "available", price: 258.00, is_closed: false },
  { room_number: "209", type_code: "nuan_ju_jiating", status: "occupied", price: 368.00, is_closed: false },
  { room_number: "210", type_code: "nuan_ju_jiating", status: "available", price: 368.00, is_closed: false },
  { room_number: "212", type_code: "nuan_ju_jiating", status: "available", price: 368.00, is_closed: false },
  { room_number: "309", type_code: "nuan_ju_jiating", status: "available", price: 368.00, is_closed: false },
  { room_number: "310", type_code: "nuan_ju_jiating", status: "available", price: 368.00, is_closed: false },
  { room_number: "112", type_code: "zui_shan_tang", status: "available", price: 398.00, is_closed: false },
  { room_number: "116", type_code: "zui_shan_tang", status: "available", price: 398.00, is_closed: false },
  { room_number: "101", type_code: "asu_xiao_zhu", status: "occupied", price: 288.00, is_closed: false },
  { room_number: "102", type_code: "asu_xiao_zhu", status: "available", price: 288.00, is_closed: false },
  { room_number: "103", type_code: "asu_xiao_zhu", status: "available", price: 288.00, is_closed: false },
  { room_number: "105", type_code: "asu_xiao_zhu", status: "available", price: 288.00, is_closed: false },
  { room_number: "106", type_code: "asu_xiao_zhu", status: "available", price: 288.00, is_closed: false },
  { room_number: "107", type_code: "asu_xiao_zhu", status: "available", price: 288.00, is_closed: false },
  { room_number: "108", type_code: "asu_xiao_zhu", status: "available", price: 288.00, is_closed: false },
  { room_number: "109", type_code: "asu_xiao_zhu", status: "available", price: 288.00, is_closed: false },
  { room_number: "110", type_code: "asu_xiao_zhu", status: "available", price: 288.00, is_closed: false },
  { room_number: "203", type_code: "sheng_sheng_man", status: "available", price: 348.00, is_closed: false },
  { room_number: "205", type_code: "yi_jiang_nan", status: "cleaning", price: 268.00, is_closed: false },
  { room_number: "206", type_code: "bo_ye_shuang", status: "available", price: 258.00, is_closed: false },
  { room_number: "207", type_code: "bo_ye_shuang", status: "available", price: 258.00, is_closed: false },
  { room_number: "208", type_code: "bo_ye_shuang", status: "available", price: 258.00, is_closed: false },
  { room_number: "301", type_code: "sheng_sheng_man", status: "available", price: 348.00, is_closed: false },
  { room_number: "302", type_code: "bo_ye_shuang", status: "available", price: 258.00, is_closed: false },
  { room_number: "303", type_code: "sheng_sheng_man", status: "available", price: 348.00, is_closed: false },
  { room_number: "305", type_code: "yi_jiang_nan", status: "available", price: 268.00, is_closed: false },
  { room_number: "306", type_code: "bo_ye_shuang", status: "available", price: 258.00, is_closed: false },
  { room_number: "401", type_code: "yun_ju_ying_yin", status: "available", price: 428.00, is_closed: false },
  { room_number: "402", type_code: "yun_ju_ying_yin", status: "available", price: 428.00, is_closed: false },
  { room_number: "403", type_code: "xing_yun_ge", status: "available", price: 388.00, is_closed: false }
];

async function addRoomType(roomTypes) {
  // Implementation for adding a room type
  for (const type of roomTypes) {
    await db.query(
      `INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
       VALUES ($1, $2, $3, $4, $5)`,
      [type.type_code, type.type_name, type.base_price, type.description, type.is_closed]
    );
  }
}

async function addRoom(rooms) {
  // Implementation for adding a room
  for (const room of rooms) {
    await db.query(
      `INSERT INTO rooms (room_number, type_code, status, price, is_closed)
        VALUES ($1, $2, $3, $4, $5)`,
      [room.room_number, room.type_code, room.status, room.price, room.is_closed]
    );
  }
}

module.exports = {
  roomTypes,
  rooms,
  addRoomType,
  addRoom
};
