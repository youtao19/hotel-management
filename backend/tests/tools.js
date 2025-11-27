const db = require('../database/postgreDB/pg');
const request = require('supertest');
const app = require('../app');

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

const mockOrders = [
  {
    order_id: "TEST_ORDER_1",
    id_source: null,
    order_source: "test",
    guest_name: "测试用户A",
    phone: "13800000001",
    room_type: "TEST_STD_ROOM",
    room_number: "TEST_ROOM_101",
    check_in_date: "2024-01-01",
    check_out_date: "2024-01-02",
    status: "pending",
    payment_method: "现金",
    total_price: 100.00,
    deposit: 200.00,
    is_prepaid: false,
    prepaid_amount: 0,
    create_time: new Date(),
    stay_type: "客房",
    remarks: "测试订单"
  },
  {
    order_id: "TEST_ORDER_2",
    id_source: null,
    order_source: "test",
    guest_name: "测试用户B",
    phone: "13800000002",
    room_type: "asu_xiao_zhu",
    room_number: "102",
    check_in_date: "2024-01-03",
    check_out_date: "2024-01-03",
    status: "pending",
    payment_method: "现金",
    total_price: 288.00,
    deposit: 100.00,
    is_prepaid: false,
    prepaid_amount: 0,
    create_time: new Date(),
    stay_type: "休息房",
    remarks: "测试订单"
  }
];

const ORDERS = mockOrders;

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

async function createOrder(orders) {
  const toArray = Array.isArray(orders) ? orders : [orders];

  const normalizeDate = (d) => {
    if (!d) return d;
    return typeof d === "string" ? d.substring(0, 10) : new Date(d).toISOString().split("T")[0];
  };

  const buildStayDates = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end || start);
    let nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (nights <= 0) nights = 1;
    const days = [];
    for (let i = 0; i < nights; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  const buildTotalPrice = (raw, stayDates) => {
    if (raw && typeof raw.total_price === "object" && raw.total_price !== null && !Array.isArray(raw.total_price)) {
      return raw.total_price;
    }
    const fallback = raw?.total_price ?? raw?.price ?? raw?.room_price ?? 0;
    const numeric = Number(fallback);
    const safePrice = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
    return stayDates.reduce((acc, day) => {
      acc[day] = safePrice;
      return acc;
    }, {});
  };

  for (const raw of toArray) {
    // 仅保留 schema 允许的字段，避免 additionalProperties 校验失败
    const payload = {
      order_id: raw.order_id,
      id_source: raw.id_source,
      order_source: raw.order_source,
      guest_name: raw.guest_name,
      room_type: raw.room_type,
      room_number: raw.room_number,
      check_in_date: raw.check_in_date,
      check_out_date: raw.check_out_date,
      status: raw.status,
      payment_method: raw.payment_method,
      phone: raw.phone,
      total_price: raw.total_price,
      deposit: raw.deposit,
      is_prepaid: raw.is_prepaid,
      prepaid_amount: raw.prepaid_amount,
      prepaid_at: raw.prepaid_at,
      stay_type: raw.stay_type,
      create_time: raw.create_time,
      remarks: raw.remarks
    };

    // 规范 id_source（AJV 仅接受字符串）
    if (payload.id_source === undefined || payload.id_source === null || payload.id_source === '') {
      delete payload.id_source;
    } else {
      payload.id_source = String(payload.id_source);
    }

    payload.order_id = payload.order_id || `TEST_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    payload.order_source = payload.order_source || "test";
    payload.payment_method = payload.payment_method || "现金";
    payload.status = payload.status || "pending";
    payload.phone = payload.phone || "13800000000";
    payload.guest_name = payload.guest_name || "测试用户";
    payload.check_in_date = normalizeDate(payload.check_in_date || new Date());
    payload.check_out_date = normalizeDate(payload.check_out_date || payload.check_in_date);

    const stayDates = buildStayDates(payload.check_in_date, payload.check_out_date);
    payload.total_price = buildTotalPrice(raw, stayDates);

    payload.stay_type = payload.stay_type || (payload.check_in_date === payload.check_out_date ? "休息房" : "客房");
    payload.create_time = payload.create_time ? new Date(payload.create_time).toISOString() : new Date().toISOString();
    payload.deposit = payload.deposit === undefined ? 0 : Number(payload.deposit);
    payload.is_prepaid = Boolean(payload.is_prepaid);
    payload.prepaid_amount = payload.prepaid_amount === undefined ? 0 : Number(payload.prepaid_amount);

    // 移除 undefined/null 字段，避免 AJV 将 null 视为不合法类型
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || payload[key] === null) {
        delete payload[key];
      }
    });

    const response = await request(app)
      .post('/api/orders/new')
      .send(payload);

    if (response.statusCode >= 400) {
      const err = new Error(`创建测试订单失败: ${response.statusCode} ${response.text}`);
      err.response = response;
      throw err;
    }
  }
}

module.exports = {
  roomTypes,
  rooms,
  mockOrders,
  ORDERS,
  addRoomType,
  addRoom,
  createOrder
};
