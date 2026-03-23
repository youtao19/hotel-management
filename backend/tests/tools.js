const db = require('../database/postgreDB/pg');
const request = require('supertest');
const app = require('../app');
const { createOrder } = require('../modules/orderModule');

const roomTypes = [
  {
    type_code: "TEST_STD_ROOM",
    type_name: "测试标准房",
    base_price: 100.00,
    description: "用于测试的标准房型",
    is_closed: false
  },
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
  { room_number: "TEST_ROOM_101", type_code: "TEST_STD_ROOM", status: "available", price: 100.00, is_closed: false },
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

const ORDERS = [
  {
    "orderId": "ORDER-20251129-001",
    "sourceNumber": "MT-883921",
    "orderSource": "美团",
    "guestName": "张三",
    "roomType": "xing_yun_ge",
    "roomNumber": "403",
    "checkInDate": "2025-11-30",
    "checkOutDate": "2025-12-02",
    "status": "pending",
    "paymentMethod": "微信",
    "phone": "13812345678",
    "roomPrice": {
      "2025-11-30": 268,
      "2025-12-01": 288
    },
    "deposit": 200,
    "isPrepaid": false,
    "prepaidAmount": 0,
    "stayType": "客房",
    "createTime": "2025-11-29T10:30:00+08:00",
    "remarks": "需要安静房间，尽量高楼层"
  },
  { // 休息房，当天入住当天离店，部分预付
    "orderId": "ORDER-20251129-002",
    "sourceNumber": "QTT-20251129-02",
    "orderSource": "前台",
    "guestName": "李四",
    "roomType": "yi_jiang_nan",
    "roomNumber": "205",
    "checkInDate": "2025-11-29",
    "checkOutDate": "2025-11-29",
    "status": "reserved",
    "paymentMethod": "微信支付",
    "phone": "13987654321",
    "roomPrice": {
      "2025-11-29": "120.00"
    },
    "deposit": 100,
    "isPrepaid": true,
    "prepaidAmount": 50,
    "stayType": "休息房",
    "createTime": "2025-11-29T09:15:23+08:00",
    "remarks": "预计停留 4 小时"
  },
  { // 长住订单，多日不同房价，未留手机号
    "orderId": "ORDER-20251201-003",
    "sourceNumber": "CTRIP-99123",
    "orderSource": "携程",
    "guestName": "王五",
    "roomType": "nuan_ju_jiating",
    "roomNumber": "210",
    "checkInDate": "2025-12-01",
    "checkOutDate": "2025-12-05",
    "status": "pending",
    "paymentMethod": "预付",
    "phone": "",
    "roomPrice": {
      "2025-12-01": 320,
      "2025-12-02": 320,
      "2025-12-03": 350.5,
      "2025-12-04": 360.00
    },
    "deposit": 400,
    "isPrepaid": true,
    "prepaidAmount": 1280,
    "stayType": "客房",
    "createTime": "2025-11-28T21:00:00+08:00",
    "remarks": "商务客户，含早餐"
  },
]

/**
 * 批量写入测试房型数据。
 * @param {Array<{type_code: string, type_name: string, base_price: number, description: string|null, is_closed: boolean}>} roomTypes 房型数据列表
 * @returns {Promise<void>} 写入完成后返回 Promise
 * @throws {Error} 数据库写入失败时抛出异常
 */
async function addRoomType(roomTypes) {
  for (const type of roomTypes) {
    await db.query(
      `INSERT INTO room_types (type_code, type_name, base_price, description, is_closed)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (type_code) DO NOTHING`,
      [type.type_code, type.type_name, type.base_price, type.description, type.is_closed]
    );
  }
}

/**
 * 批量写入测试房间数据。
 * @param {Array<{room_number: string, type_code: string, status: string, price: number, is_closed: boolean}>} rooms 房间数据列表
 * @returns {Promise<void>} 写入完成后返回 Promise
 * @throws {Error} 数据库写入失败时抛出异常
 */
async function addRoom(rooms) {
  for (const room of rooms) {
    await db.query(
      `INSERT INTO rooms (room_number, type_code, status, price, is_closed)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (room_number) DO NOTHING`,
      [room.room_number, room.type_code, room.status, room.price, room.is_closed]
    );
  }
}

const buildOrderPayload = (overrides = {}) => ({
  ...ORDERS[0],
  orderId: `TEST_ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  ...overrides
});



module.exports = {
  roomTypes,
  rooms,
  ORDERS,
  addRoomType,
  addRoom,
  createOrder,
  buildOrderPayload
};
