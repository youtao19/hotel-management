const postgreDB = require('../../../database/postgreDB/pg')
const { createOrder } = require('../../orderModule')
const { buildCreateOrderDataFromDouyin } = require('../mappers/orderCreate.adapter')

/**
 * 根据抖音 OTA 订单号查询本地系统订单主行。
 * 说明：
 * 1. 本地 orders 按入住天数拆分为多行；
 * 2. 仅入住首日行满足 stay_date = check_in_date，可作为幂等主行；
 * 3. 当抖音回调重复到达或上次回写失败时，可用该查询恢复同步状态。
 *
 * @param {string} otaOrderId 抖音 OTA 订单号。
 * @param {Object} queryRunner 数据库执行器，支持 query 方法。
 * @returns {Promise<string|null>} 已存在的系统订单号；不存在时返回 null。
 * @throws {Error} 数据库查询失败时抛出异常。
 */
async function findExistingSystemOrderIdByOtaOrderId(otaOrderId, queryRunner = postgreDB) {
  const existingOrderSql = `
    SELECT order_id
    FROM orders
    WHERE order_source = 'douyin'
      AND id_source = $1
      AND stay_date = check_in_date
    ORDER BY id ASC
    LIMIT 1
  `

  const existingOrderResult = await queryRunner.query(existingOrderSql, [otaOrderId])
  return existingOrderResult.rows[0]?.order_id || null
}

/**
 * 回写抖音订单同步状态。
 *
 * @param {string} otaOrderId 抖音 OTA 订单号。
 * @param {string} systemOrderId 本地系统订单号。
 * @param {Object} queryRunner 数据库执行器，支持 query 方法。
 * @returns {Promise<void>} 回写完成后返回。
 * @throws {Error} 数据库更新失败时抛出异常。
 */
async function markDouyinOrderSynced(otaOrderId, systemOrderId, confirmMode, queryRunner = postgreDB) {
  const updateDouyinOrderSql = `
    UPDATE douyin_orders
    SET synced = TRUE,
        system_order_id = $2,
        confirm_mode = COALESCE($3, confirm_mode),
        updated_at = NOW()
    WHERE ota_order_id = $1
  `

  await queryRunner.query(updateDouyinOrderSql, [otaOrderId, systemOrderId, confirmMode ?? null])
}

/**
 * 回写抖音订单同步失败信息。
 *
 * @param {string} otaOrderId 抖音 OTA 订单号。
 * @param {Error} error 原始异常。
 * @param {Object} queryRunner 数据库执行器。
 * @returns {Promise<void>} 回写完成。
 */
async function markDouyinOrderSyncFailed(otaOrderId, error, queryRunner = postgreDB) {
  await queryRunner.query(
    `
    UPDATE douyin_orders
    SET booking_stage = 'system_create_failed',
        booking_error_description = $2,
        booking_failure_response = $3,
        updated_at = NOW()
    WHERE ota_order_id = $1
    `,
    [
      otaOrderId,
      String(error?.message || 'Create local order failed'),
      JSON.stringify({
        message: String(error?.message || 'Create local order failed'),
        code: error?.code || null,
      }),
    ]
  )
}

/**
 * 判断是否命中本地订单来源单号唯一约束。
 *
 * @param {Error} error 数据库异常对象。
 * @returns {boolean} 命中唯一约束时返回 true，否则返回 false。
 */
function isDuplicateSourceConstraintError(error) {
  return error?.code === '23505' && (
    error.constraint === 'uniq_orders_source_id_source_primary_row' ||
    String(error.message || '').includes('uniq_orders_source_id_source_primary_row')
  )
}

/**
 * 将抖音落地订单同步为本地系统订单。
 * 幂等规则：
 * 1. douyin_orders 已标记 synced 时直接跳过；
 * 2. 若本地 orders 已存在相同抖音来源单号，则补写 synced 状态；
 * 3. 若创建期间遇到唯一约束冲突，则按已存在订单恢复。
 *
 * @param {string} otaOrderId 抖音 OTA 订单号。
 * @returns {Promise<{action:string, systemOrderId:string|null}>} 同步结果。
 * @throws {Error} 抖音订单不存在或数据库异常时抛出异常。
 */
async function syncDouyinOrderToSystem(otaOrderId, options = {}) {
  /** @type {Object|null} 数据库事务连接。 */
  let client = null
  /** @type {boolean} 是否需要在事务外补记同步失败。 */
  let shouldMarkSyncFailed = false
  /** @type {Error|null} 需要补记的同步异常。 */
  let syncFailureError = null

  try {
    client = await postgreDB.getClient()
    await client.query('BEGIN')

    // 加行锁，避免同一抖音单被并发重复同步。
    const orderRes = await client.query(
      `SELECT * FROM douyin_orders WHERE ota_order_id = $1 LIMIT 1 FOR UPDATE`,
      [otaOrderId]
    )

    const douyinOrder = orderRes.rows[0]

    if (!douyinOrder) {
      throw new Error('Douyin order not found')
    }

    /** @type {number|null} 本次创单接单模式。 */
    const confirmMode = options.confirmMode ?? douyinOrder?.confirm_mode ?? null
    // 已经同步过则直接返回，避免重复写本地订单。
    if (douyinOrder.synced) {
      await client.query('COMMIT')
      return {
        action: 'skip',
        systemOrderId: douyinOrder.system_order_id,
        confirmMode: douyinOrder.confirm_mode ?? confirmMode,
      }
    }

    // 历史半成功场景：本地订单已存在，但 douyin_orders 还未回写 synced。
    const recoveredSystemOrderId = await findExistingSystemOrderIdByOtaOrderId(otaOrderId, client)

    if (recoveredSystemOrderId) {
      await markDouyinOrderSynced(otaOrderId, recoveredSystemOrderId, confirmMode, client)
      await client.query('COMMIT')
      return {
        action: 'recovered',
        systemOrderId: recoveredSystemOrderId,
        confirmMode,
      }
    }

    const orderData = await buildCreateOrderDataFromDouyin(douyinOrder)

    try {
      const insertRes = await createOrder(orderData, client)
      const systemOrderId = insertRes?.orderId || null

      await markDouyinOrderSynced(otaOrderId, systemOrderId, confirmMode, client)
      await client.query('COMMIT')

      return {
        action: 'created',
        systemOrderId,
        confirmMode,
      }
    } catch (error) {
      // 并发回调可能导致另一事务已创建成功，此时按已存在订单恢复即可。
      if (isDuplicateSourceConstraintError(error)) {
        const conflictSystemOrderId = await findExistingSystemOrderIdByOtaOrderId(otaOrderId, client)

        if (conflictSystemOrderId) {
          await markDouyinOrderSynced(otaOrderId, conflictSystemOrderId, confirmMode, client)
          await client.query('COMMIT')
          return {
            action: 'recovered',
            systemOrderId: conflictSystemOrderId,
            confirmMode,
          }
        }
      }

      shouldMarkSyncFailed = true
      syncFailureError = error
      throw error
    }
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK')
    }

    if (shouldMarkSyncFailed && otaOrderId) {
      try {
        await markDouyinOrderSyncFailed(otaOrderId, syncFailureError || error)
      } catch (persistError) {
        console.error('[syncDouyinOrderToSystem] save sync failure failed:', persistError.message)
      }
    }
    throw error
  } finally {
    if (client) {
      client.release()
    }
  }
}

module.exports = {
  markDouyinOrderSyncFailed,
  syncDouyinOrderToSystem,
}
