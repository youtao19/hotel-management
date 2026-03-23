const { query, getClient } = require("../../database/postgreDB/pg");
const { createOrder, updateOrderStatus } = require("../../modules/orderModule");

function generateOrderNumber() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `O${year}${month}${day}${random}`
}

/**
 * 根据房型和入住区间随机分配一个可用房号。
 * @param {string} roomType 房型编码（对应 rooms.type_code）
 * @param {string} checkInDate 入住日期（YYYY-MM-DD）
 * @param {string} checkOutDate 退房日期（YYYY-MM-DD）
 * @returns {Promise<string|null>} 返回随机可用房号；无可用房时返回 null
 * @throws {Error} 参数缺失或数据库查询失败时抛出异常
 */
async function randomRoomNumber(roomType, checkInDate, checkOutDate) {
  // 房间分配参与占用冲突计算的订单状态。
  const activeOrderStatuses = ['pending', 'reserved', 'checked-in', 'occupied'];
  // 入住日期字符串，统一裁剪为 YYYY-MM-DD，避免携带时间部分。
  const normalizedCheckInDate = String(checkInDate || '').split('T')[0];
  // 退房日期字符串，统一裁剪为 YYYY-MM-DD。
  const normalizedCheckOutDate = String(checkOutDate || '').split('T')[0];

  if (!roomType || !normalizedCheckInDate || !normalizedCheckOutDate) {
    const invalidParamError = new Error('随机分配房间失败：roomType、checkInDate、checkOutDate 为必填参数');
    invalidParamError.code = 'INVALID_ROOM_ASSIGN_PARAMS';
    throw invalidParamError;
  }

  // 按房型筛选可用房，并排除在所选日期区间内已有有效订单占用的房间。
  const findAvailableRoomsSql = `
    SELECT r.room_number
    FROM rooms r
    WHERE r.type_code = $1
      AND r.is_closed = FALSE
      AND r.status <> 'repair'
      AND NOT EXISTS (
        SELECT 1
        FROM orders o
        WHERE o.room_number = r.room_number
          AND o.status = ANY($4::text[])
          AND o.stay_date >= $2::date
          AND o.stay_date < (
            CASE
              WHEN $2::date = $3::date THEN ($2::date + 1)
              ELSE $3::date
            END
          )
      )
    ORDER BY r.room_number
  `;

  const availableRoomResult = await query(findAvailableRoomsSql, [
    roomType,
    normalizedCheckInDate,
    normalizedCheckOutDate,
    activeOrderStatuses
  ]);

  if (!availableRoomResult.rows.length) {
    return null;
  }

  // 在可用房间集合内随机选一个房间号返回。
  const randomIndex = Math.floor(Math.random() * availableRoomResult.rows.length);
  return availableRoomResult.rows[randomIndex].room_number;
}

async function checkRoomTypeExists(roomType) {
  if (!roomType) {
    return false;
  }

  const roomTypeResult = await query(
    `select 1 from room_types where type_code=$1 limit 1`,
    [roomType]
  );

  return roomTypeResult.rows.length > 0;
}

/**
 * 根据平台与 OTA 订单号查询已存在的映射关系。
 * @param {string} platform OTA 平台标识
 * @param {string} otaOrderId OTA 订单号
 * @returns {Promise<object|null>} 已存在时返回映射记录，不存在时返回 null
 * @throws {Error} 数据库查询失败时抛出异常
 */
async function findExistingPluginOrderRelation(platform, otaOrderId) {
  const relationResult = await query(
    `select * from ota_order_relation where platform=$1 and ota_order_id=$2 limit 1`,
    [platform, otaOrderId]
  );

  return relationResult.rows[0] || null;
}

async function createPluginOrderService({
  platform,
  otaOrderId,
  guestName,
  roomType,
  checkInDate,
  checkOutDate,
  roomPrice,
  totalPrice,
  otaOrderStatus,
  rawData,
  pluginAuth
}) {
  // 插件能给的数据
  /*
  data = {
  "platform": "meituan",
  "otaOrderId": "1234567890",
  "guestName": "张三",
  "roomType": "大床房",
  "checkInDate": "2024-07-01",
  "checkOutDate": "2024-07-03",
  "roomPrice": {
    "yyyy-mm-dd": xx,
    "yyyy-mm-dd": xx
    },
  }
  */

  if (otaOrderStatus === 'cancelled') {
    // 新增能力：已取消 OTA 订单不进入原创建流程，单独走取消逻辑。
    return await cancelPluginOrder({
      platform,
      otaOrderId,
      guestName,
      roomType,
      checkInDate,
      checkOutDate,
      roomPrice,
      totalPrice,
      otaOrderStatus: otaOrderStatus,
      rawData,
      pluginAuth
    });
  }

  // 同一 OTA 订单重复推送时，优先按重复订单返回，避免先进入排房逻辑后被误判为无房。
  const existingRelation = await findExistingPluginOrderRelation(platform, otaOrderId);

  if (existingRelation) {
    return {
      success: false,
      code: "PLUGIN_ORDER_ALREADY_EXISTS",
      message: "插件订单已存在",
    }
  }

  const roomTypeExists = await checkRoomTypeExists(roomType);

  if (!roomTypeExists) {
    throw {
      statusCode: 409,
      code: "PLUGIN_ORDER_ROOM_TYPE_INVALID",
      message: `房型未映射或不存在：${roomType || '-'}`,
    }
  }

  const roomNumber = await randomRoomNumber(roomType, checkInDate, checkOutDate);

  if (!roomNumber) {
    throw {
      statusCode: 409,
      code: "PLUGIN_ORDER_ROOM_UNAVAILABLE",
      message: `未找到可用本地房间：房型编码 ${roomType || '-'}，入住 ${checkInDate || '-'}，离店 ${checkOutDate || '-'}`,
    }
  }

  const orderData = {
    orderId: generateOrderNumber(),
    sourceNumber: otaOrderId, // OTA 订单号
    orderSource: platform, // 订单来源平台
    guestName,
    phone: null, // 插件订单暂不提供手机号
    roomType,
    roomNumber, // 插件订单暂不分配房间号
    checkInDate,
    checkOutDate,
    status: 'pending', // 插件订单初始状态为待入住
    paymentMethod: '平台', // 插件订单暂不提供支付方式
    roomPrice, // 将房价信息序列化为字符串存储
    deposit: null, // 插件订单暂不提供押金信息
    createTime: new Date(), // 订单创建时间
    remarks: null, // 插件订单暂不提供备注信息
    isPrepaid: false, // 插件订单默认非预付
    prepaidAmount: null, // 插件订单暂不提供预付金额信息
    stayType: '客房' // 插件订单默认住宿类型为客房
  }

  // 关系表总价：优先使用请求总价，缺失时按每日房价汇总。
  const otaTotalPrice = Number.isFinite(Number(totalPrice))
    ? Number(totalPrice)
    : (roomPrice && typeof roomPrice === 'object'
      ? Number(
        Object.values(roomPrice).reduce((sum, price) => {
          const normalizedPrice = Number(price);
          return Number.isFinite(normalizedPrice) ? sum + normalizedPrice : sum;
        }, 0).toFixed(2)
      )
      : null);

  let client = null;
  try {
    // 使用数据库连接开启事务，确保订单与映射写入原子性。
    client = await getClient();
    await client.query('BEGIN');

    // 将订单插入数据库
    await createOrder(orderData,client);

    // 插入relation 表
    const insertRelationSql = `
    INSERT INTO ota_order_relation (
      platform,
      ota_order_id,
      local_order_id,
      ota_room_type,
      ota_guest_name,
      ota_check_in_date,
      ota_check_out_date,
      ota_total_price,
      ota_order_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (platform, ota_order_id)
    DO UPDATE SET
      local_order_id = EXCLUDED.local_order_id,
      ota_room_type = EXCLUDED.ota_room_type,
      ota_guest_name = EXCLUDED.ota_guest_name,
      ota_check_in_date = EXCLUDED.ota_check_in_date,
      ota_check_out_date = EXCLUDED.ota_check_out_date,
      ota_total_price = EXCLUDED.ota_total_price,
      ota_order_status = EXCLUDED.ota_order_status,
      updated_at = now()
  `;
    await client.query(insertRelationSql, [
      platform,
      otaOrderId,
      orderData.orderId,
      roomType || null,
      guestName || null,
      checkInDate || null,
      checkOutDate || null,
      otaTotalPrice,
      otaOrderStatus || null
    ]);

    // 提交事务，完成订单与映射的一致写入。
    await client.query('COMMIT');

    return {
      success: true,
      code: "PLUGIN_ORDER_CREATED",
      message: "插件订单创建成功",
      platform,
      otaOrderId
    }
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error("创建插件订单失败:", error);
    throw {
      statusCode: Number(error.statusCode || 500),
      code: error.code || "PLUGIN_ORDER_CREATE_FAILED",
      message: error.detail || error.message || "插件订单创建失败",
      details: error.detail || error.details || error.message
    }
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function cancelPluginOrder({
  platform,
  otaOrderId,
  guestName,
  roomType,
  checkInDate,
  checkOutDate,
  roomPrice,
  totalPrice,
  otaOrderStatus,
  rawData,
  pluginAuth
}) {
  const otaTotalPrice = Number.isFinite(Number(totalPrice))
    ? Number(totalPrice)
    : (roomPrice && typeof roomPrice === 'object'
      ? Number(
        Object.values(roomPrice).reduce((sum, price) => {
          const normalizedPrice = Number(price);
          return Number.isFinite(normalizedPrice) ? sum + normalizedPrice : sum;
        }, 0).toFixed(2)
      )
      : null);

  let client = null;
  try {
    // 先查 OTA 订单映射；如果本地从未导入，那么不需要执行。
    const existingRelation = await findExistingPluginOrderRelation(platform, otaOrderId);

    if (!existingRelation) {
      return {
        success: true,
        code: "PLUGIN_ORDER_CANCEL_SKIPPED",
        message: "未找到已导入订单，已跳过取消",
        platform,
        otaOrderId
      }
    }

    const relationRow = existingRelation;
    client = await getClient();
    await client.query('BEGIN');

    // 锁住本地订单，避免插件取消与人工改状态同时发生。
    const localOrderSql = `select * from orders where order_id=$1 order by stay_date asc for update`;
    const localOrderResult = await client.query(localOrderSql, [relationRow.local_order_id]);

    if (localOrderResult.rows.length === 0) {
      // 映射存在但本地订单缺失时，仅回写 OTA 订单基础信息，不做状态更新。
      await client.query(
        `update ota_order_relation
           set ota_room_type=$3,
               ota_guest_name=$4,
               ota_check_in_date=$5,
               ota_check_out_date=$6,
               ota_total_price=$7,
               ota_order_status=$8,
               updated_at=now()
         where platform=$1 and ota_order_id=$2`,
        [
          platform,
          otaOrderId,
          roomType || null,
          guestName || null,
          checkInDate || null,
          checkOutDate || null,
          otaTotalPrice,
          otaOrderStatus || null
        ]
      );

      await client.query('COMMIT');

      return {
        success: false,
        code: "PLUGIN_ORDER_CANCEL_FAILED",
        message: "已找到 OTA 订单映射，但本地订单不存在",
        platform,
        otaOrderId
      }
    }

    const firstOrder = localOrderResult.rows[0];

    if (firstOrder.status === 'cancelled') {
      // 本地订单已经是取消态时保持幂等，只刷新 OTA 订单基础信息。
      await client.query(
        `update ota_order_relation
           set ota_room_type=$3,
               ota_guest_name=$4,
               ota_check_in_date=$5,
               ota_check_out_date=$6,
               ota_total_price=$7,
               ota_order_status=$8,
               updated_at=now()
         where platform=$1 and ota_order_id=$2`,
        [
          platform,
          otaOrderId,
          roomType || null,
          guestName || null,
          checkInDate || null,
          checkOutDate || null,
          otaTotalPrice,
          otaOrderStatus || null
        ]
      );

      await client.query('COMMIT');

      return {
        success: true,
        code: "PLUGIN_ORDER_ALREADY_CANCELLED",
        message: "本地订单已取消，无需重复处理",
        platform,
        otaOrderId
      }
    }

    if (!['pending', 'reserved'].includes(firstOrder.status)) {
      // 当前仅允许取消待入住/已预订订单，避免覆盖已入住等后续流程状态。
      await client.query(
        `update ota_order_relation
           set ota_room_type=$3,
               ota_guest_name=$4,
               ota_check_in_date=$5,
               ota_check_out_date=$6,
               ota_total_price=$7,
               ota_order_status=$8,
               updated_at=now()
         where platform=$1 and ota_order_id=$2`,
        [
          platform,
          otaOrderId,
          roomType || null,
          guestName || null,
          checkInDate || null,
          checkOutDate || null,
          otaTotalPrice,
          otaOrderStatus || null
        ]
      );

      await client.query('COMMIT');

      return {
        success: false,
        code: "PLUGIN_ORDER_CANCEL_INVALID_STATUS",
        message: `本地订单当前状态为 ${firstOrder.status}，无法通过插件取消`,
        platform,
        otaOrderId
      }
    }

    // 真正的取消动作复用现有订单状态更新逻辑。
    await updateOrderStatus(relationRow.local_order_id, 'cancelled', client);

    // 取消成功后同步 OTA 映射表中的状态与基础信息。
    await client.query(
      `update ota_order_relation
         set ota_room_type=$3,
             ota_guest_name=$4,
             ota_check_in_date=$5,
             ota_check_out_date=$6,
             ota_total_price=$7,
             ota_order_status=$8,
             updated_at=now()
       where platform=$1 and ota_order_id=$2`,
      [
        platform,
        otaOrderId,
        roomType || null,
        guestName || null,
        checkInDate || null,
        checkOutDate || null,
        otaTotalPrice,
        otaOrderStatus || null
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      code: "PLUGIN_ORDER_CANCELLED",
      message: "插件订单取消成功",
      platform,
      otaOrderId
    }
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error("取消插件订单失败:", error);
    throw {
      statusCode: Number(error.statusCode || 500),
      code: error.code || "PLUGIN_ORDER_CANCEL_FAILED",
      message: error.detail || error.message || "插件订单取消失败",
      details: error.detail || error.details || error.message
    }
  } finally {
    if (client) {
      client.release();
    }
  }
}


module.exports = {
  createPluginOrderService,
  cancelPluginOrderService: cancelPluginOrder
};
