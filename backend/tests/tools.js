const db = require('../database/postgreDB/pg');

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
    order_id: "ORD20251027001",
    id_source: "web",
    order_source: "官网预订",
    guest_name: "张伟",
    room_type: "asu_xiao_zhu",
    room_number: "101",
    check_in_date: "2025-10-28",
    check_out_date: "2025-10-30",
    status: "reserved",
    payment_method: "支付宝",
    phone: "13800138000",
    total_price: 576.00,
    deposit: 200.00,
    stay_type: "客房",
    create_time: "2025-10-27T09:30:00Z",
    remarks: "提前入住，请准备好房卡"
  },
  {
    order_id: "ORD20251027002",
    id_source: "wechat",
    order_source: "微信小程序",
    guest_name: "李娜",
    room_type: "bo_ye_shuang",
    room_number: "207",
    check_in_date: "2025-10-29",
    check_out_date: "2025-10-31",
    status: "reserved",
    payment_method: "微信支付",
    phone: "13911223344",
    total_price: 516.00,
    deposit: 150.00,
    stay_type: "客房",
    create_time: "2025-10-27T10:10:00Z",
    remarks: "两位客人，需额外毛巾"
  },
  {
    order_id: "ORD20251027003",
    id_source: "frontdesk",
    order_source: "前台办理",
    guest_name: "王强",
    room_type: "nuan_ju_jiating",
    room_number: "210",
    check_in_date: "2025-10-27",
    check_out_date: "2025-10-28",
    status: "occupied",
    payment_method: "现金",
    phone: "13799887766",
    total_price: 368.00,
    deposit: 100.00,
    stay_type: "客房",
    create_time: "2025-10-27T08:00:00Z",
    remarks: "带儿童一名"
  },
  {
    order_id: "ORD20251027004",
    id_source: "web",
    order_source: "官网预订",
    guest_name: "陈晨",
    room_type: "sheng_sheng_man",
    room_number: "203",
    check_in_date: "2025-10-31",
    check_out_date: "2025-11-02",
    status: "reserved",
    payment_method: "支付宝",
    phone: "13666778899",
    total_price: 696.00,
    deposit: 200.00,
    stay_type: "客房",
    create_time: "2025-10-27T09:45:00Z",
    remarks: "喜欢安静房间"
  },
  {
    order_id: "ORD20251027005",
    id_source: "wechat",
    order_source: "微信小程序",
    guest_name: "赵敏",
    room_type: "yun_ju_ying_yin",
    room_number: "401",
    check_in_date: "2025-10-28",
    check_out_date: "2025-10-29",
    status: "reserved",
    payment_method: "微信支付",
    phone: "13544556677",
    total_price: 428.00,
    deposit: 150.00,
    stay_type: "客房",
    create_time: "2025-10-27T11:00:00Z",
    remarks: "生日入住，需布置气球"
  },
  {
    order_id: "ORD20251027006",
    id_source: "frontdesk",
    order_source: "前台办理",
    guest_name: "刘洋",
    room_type: "you_ge_yuan_zi",
    room_number: "115",
    check_in_date: "2025-10-27",
    check_out_date: "2025-10-28",
    status: "occupied",
    payment_method: "现金",
    phone: "13900001111",
    total_price: 388.00,
    deposit: 100.00,
    stay_type: "客房",
    create_time: "2025-10-27T08:15:00Z",
    remarks: "上午退房"
  },
  {
    order_id: "ORD20251027007",
    id_source: "web",
    order_source: "官网预订",
    guest_name: "孙梅",
    room_type: "xing_yun_ge",
    room_number: "403",
    check_in_date: "2025-11-01",
    check_out_date: "2025-11-03",
    status: "reserved",
    payment_method: "支付宝",
    phone: "13855557777",
    total_price: 776.00,
    deposit: 200.00,
    stay_type: "客房",
    create_time: "2025-10-27T12:00:00Z",
    remarks: "两晚不含早餐"
  },
  {
    order_id: "ORD20251027008",
    id_source: "wechat",
    order_source: "微信小程序",
    guest_name: "周杰",
    room_type: "yi_jiang_nan",
    room_number: "311",
    check_in_date: "2025-10-29",
    check_out_date: "2025-10-30",
    status: "reserved",
    payment_method: "微信",
    phone: "13733445566",
    total_price: 268.00,
    deposit: 100.00,
    stay_type: "客房",
    create_time: "2025-10-27T09:10:00Z",
    remarks: "晚到达，请留房"
  },
  {
    order_id: "ORD20251027009",
    id_source: "frontdesk",
    order_source: "前台办理",
    guest_name: "黄凯",
    room_type: "zui_shan_tang",
    room_number: "112",
    check_in_date: "2025-10-27",
    check_out_date: "2025-10-27",
    status: "occupied",
    payment_method: "现金",
    phone: "13899998888",
    total_price: 398.00,
    deposit: 100.00,
    stay_type: "休息房",
    create_time: "2025-10-27T13:30:00Z",
    remarks: "临时入住四小时"
  },
  {
    order_id: "ORD20251027010",
    id_source: "web",
    order_source: "官网预订",
    guest_name: "林涛",
    room_type: "bo_ye_shuang",
    room_number: "206",
    check_in_date: "2025-10-30",
    check_out_date: "2025-10-31",
    status: "reserved",
    payment_method: "现金",
    phone: "13977889900",
    total_price: 258.00,
    deposit: 100.00,
    stay_type: "客房",
    create_time: "2025-10-27T14:00:00Z",
    remarks: "早班机离店"
  }
];

const ORDERS = [
  {
    order_id: "ORD20251027001",
    id_source: "web",
    order_source: "官网预订",
    guest_name: "张伟",
    room_type: "阿苏晓筑",
    room_number: "101",
    check_in_date: "2025-10-28",
    check_out_date: "2025-10-30",
    status: "reserved",
    payment_method: "微邮付",
    phone: "13800138000",
    total_price: {
      '2025-10-28': 288.00,
      '2025-10-29': 288.00
    },
    deposit: 200.00,
    stay_type: "客房",
    create_time: "2025-10-27T09:30:00Z",
    remarks: "提前入住，请准备好房卡"
  },
  {
    order_id: "ORD20251027002",
    id_source: "wechat",
    order_source: "微信小程序",
    guest_name: "李娜",
    room_type: "泊野双床",
    room_number: "207",
    check_in_date: "2025-10-29",
    check_out_date: "2025-10-31",
    status: "reserved",
    payment_method: "微信",
    phone: "13911223344",
    total_price: {
      '2025-10-29': 258.00,
      '2025-10-30': 258.00
    },
    deposit: 150.00,
    stay_type: "客房",
    create_time: "2025-10-27T10:10:00Z",
    remarks: "两位客人，需额外毛巾"
  },
  {
    order_id: "ORD20251027003",
    id_source: "frontdesk",
    order_source: "前台办理",
    guest_name: "王强",
    room_type: "暖居家庭房",
    room_number: "210",
    check_in_date: "2025-10-27",
    check_out_date: "2025-10-28",
    status: "occupied",
    payment_method: "现金",
    phone: "13799887766",
    total_price: {
      '2025-10-27': 368.00
    },
    deposit: 100.00,
    stay_type: "客房",
    create_time: "2025-10-27T08:00:00Z",
    remarks: "带儿童一名"
  },
  {
    order_id: "ORD20251027004",
    id_source: "web",
    order_source: "官网预订",
    guest_name: "陈晨",
    room_type: "声声慢投影大床",
    room_number: "203",
    check_in_date: "2025-10-31",
    check_out_date: "2025-11-02",
    status: "reserved",
    payment_method: "微邮付",
    phone: "13666778899",
    total_price: {
      '2025-10-31': 348.00,
      '2025-11-01': 348.00
    },
    deposit: 200.00,
    stay_type: "客房",
    create_time: "2025-10-27T09:45:00Z",
    remarks: "喜欢安静房间"
  },
  {
    order_id: "ORD20251027005",
    id_source: "wechat",
    order_source: "微信小程序",
    guest_name: "赵敏",
    room_type: "云居云端影音房",
    room_number: "401",
    check_in_date: "2025-10-28",
    check_out_date: "2025-10-29",
    status: "reserved",
    payment_method: "微信",
    phone: "13544556677",
    total_price: {
      '2025-10-28': 428.00
    },
    deposit: 150.00,
    stay_type: "客房",
    create_time: "2025-10-27T11:00:00Z",
    remarks: "生日入住，需布置气球"
  },
  {
    order_id: "ORD20251027006",
    id_source: "frontdesk",
    order_source: "前台办理",
    guest_name: "刘洋",
    room_type: "有个院子",
    room_number: "115",
    check_in_date: "2025-10-27",
    check_out_date: "2025-10-28",
    status: "occupied",
    payment_method: "现金",
    phone: "13900001111",
    total_price: {
      '2025-10-27': 388.00
    },
    deposit: 100.00,
    stay_type: "客房",
    create_time: "2025-10-27T08:15:00Z",
    remarks: "上午退房"
  },
  {
    order_id: "ORD20251027007",
    id_source: "web",
    order_source: "官网预订",
    guest_name: "孙梅",
    room_type: "行云阁",
    room_number: "403",
    check_in_date: "2025-11-01",
    check_out_date: "2025-11-03",
    status: "reserved",
    payment_method: "微邮付",
    phone: "13855557777",
    total_price: {
      '2025-11-01': 388.00,
      '2025-11-02': 388.00
    },
    deposit: 200.00,
    stay_type: "客房",
    create_time: "2025-10-27T12:00:00Z",
    remarks: "两晚不含早餐"
  },
  {
    order_id: "ORD20251027008",
    id_source: "wechat",
    order_source: "微信小程序",
    guest_name: "周杰",
    room_type: "忆江南大床房",
    room_number: "311",
    check_in_date: "2025-10-29",
    check_out_date: "2025-10-30",
    status: "reserved",
    payment_method: "微信",
    phone: "13733445566",
    total_price: {
      '2025-10-29': 268.00
    },
    deposit: 100.00,
    stay_type: "客房",
    create_time: "2025-10-27T09:10:00Z",
    remarks: "晚到达，请留房"
  },
  {
    order_id: "ORD20251027009",
    id_source: "frontdesk",
    order_source: "前台办理",
    guest_name: "黄凯",
    room_type: "醉山塘",
    room_number: "112",
    check_in_date: "2025-10-27",
    check_out_date: "2025-10-27",
    status: "occupied",
    payment_method: "现金",
    phone: "13899998888",
    total_price: {
      '2025-10-27': 398.00
    },
    deposit: 100.00,
    stay_type: "休息房",
    create_time: "2025-10-27T13:30:00Z",
    remarks: "临时入住四小时"
  },
  {
    order_id: "ORD20251027010",
    id_source: "web",
    order_source: "官网预订",
    guest_name: "林涛",
    room_type: "泊野双床",
    room_number: "206",
    check_in_date: "2025-10-30",
    check_out_date: "2025-10-31",
    status: "reserved",
    payment_method: "现金",
    phone: "13977889900",
    total_price: {
      '2025-10-30': 258.00
    },
    deposit: 100.00,
    stay_type: "客房",
    create_time: "2025-10-27T14:00:00Z",
    remarks: "早班机离店"
  }
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

async function createOrder(mockOrders) {
  // Implementation for creating an order
  for (const order of mockOrders) {
    await db.query(
      `INSERT INTO orders (order_id, id_source, order_source, guest_name, room_type, room_number,
        check_in_date, check_out_date, status, payment_method, phone, total_price, deposit,
        stay_type, create_time, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        order.order_id,
        order.id_source,
        order.order_source,
        order.guest_name,
        order.room_type,
        order.room_number,
        order.check_in_date,
        order.check_out_date,
        order.status,
        order.payment_method,
        order.phone,
        order.total_price,
        order.deposit,
        order.stay_type,
        order.create_time,
        order.remarks
      ]
    );
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
