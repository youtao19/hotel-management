const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { query } = require('../../../database/postgreDB/pg');
const douyinProductService = require('../presale-product/product.service');

const router = express.Router();
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const TIME_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$';
const CURRENCY_PATTERN = '^[A-Z]{3}$';

const ratePlanProperties = {
  room_type_code: { type: 'string', minLength: 1, maxLength: 20 },
  name: { type: 'string', minLength: 1, maxLength: 255 },
  base_price: { type: 'number', minimum: 0 },
  status: { type: 'integer', enum: [0, 1] },
  sales_type: { type: 'integer', enum: [1, 2, 3] },
  currency: { type: 'string', pattern: CURRENCY_PATTERN },
  hourly_earliest_check_in: { type: 'string', pattern: TIME_PATTERN },
  hourly_latest_check_out: { type: 'string', pattern: TIME_PATTERN },
  hourly_usage_duration: { type: 'integer', minimum: 1, maximum: 23 },
  midnight_latest_booking_time: { type: 'integer', minimum: 1, maximum: 6 },
  midnight_enabled: { type: 'boolean' },
  douyin_config: { type: 'object', additionalProperties: true }
};

const createRatePlanSchema = {
  type: 'object',
  properties: ratePlanProperties,
  required: ['room_type_code', 'name', 'base_price'],
  additionalProperties: false
};

const updateRatePlanSchema = {
  type: 'object',
  properties: ratePlanProperties,
  minProperties: 1,
  additionalProperties: false
};

const syncDouyinRatePlanSchema = {
  type: 'object',
  properties: {
    accountId: { type: 'string', minLength: 1, maxLength: 64 },
    poiId: { type: 'string', minLength: 1, maxLength: 64 }
  },
  additionalProperties: false
};

const validateCreateRatePlan = ajv.compile(createRatePlanSchema);
const validateUpdateRatePlan = ajv.compile(updateRatePlanSchema);
const validateSyncDouyinRatePlan = ajv.compile(syncDouyinRatePlanSchema);

function getValidationMessage(errors) {
  return (errors || [])
    .map((error) => `${error.instancePath || error.schemaPath} ${error.message}`)
    .join('; ');
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizePayload(payload) {
  return {
    ...payload,
    room_type_code: normalizeString(payload.room_type_code),
    name: normalizeString(payload.name),
    currency: normalizeString(payload.currency),
    hourly_earliest_check_in: normalizeString(payload.hourly_earliest_check_in),
    hourly_latest_check_out: normalizeString(payload.hourly_latest_check_out)
  };
}

function normalizeSyncPayload(payload) {
  return {
    accountId: normalizeString(payload.accountId),
    poiId: normalizeString(payload.poiId)
  };
}

function buildMergedRatePlan(existing, payload) {
  return {
    room_type_code: payload.room_type_code ?? existing.room_type_code,
    name: payload.name ?? existing.name,
    base_price: payload.base_price ?? Number(existing.base_price),
    status: payload.status ?? existing.status,
    sales_type: payload.sales_type ?? existing.sales_type,
    currency: payload.currency ?? existing.currency,
    hourly_earliest_check_in: payload.hourly_earliest_check_in ?? existing.hourly_earliest_check_in,
    hourly_latest_check_out: payload.hourly_latest_check_out ?? existing.hourly_latest_check_out,
    hourly_usage_duration: payload.hourly_usage_duration ?? existing.hourly_usage_duration,
    midnight_latest_booking_time: payload.midnight_latest_booking_time ?? existing.midnight_latest_booking_time,
    midnight_enabled: payload.midnight_enabled ?? existing.midnight_enabled,
    douyin_config: payload.douyin_config ?? existing.douyin_config
  };
}

function validateBusinessRules(ratePlan) {
  if (!ratePlan.name || !String(ratePlan.name).trim()) {
    return '套餐名称不能为空';
  }

  if (!ratePlan.room_type_code || !String(ratePlan.room_type_code).trim()) {
    return '房型编码不能为空';
  }

  // 钟点房在抖音侧要求三个字段同时存在，后端统一拦截避免同步时才失败。
  if (ratePlan.sales_type === 2) {
    const hasHourlyDetail = ratePlan.hourly_earliest_check_in
      && ratePlan.hourly_latest_check_out
      && ratePlan.hourly_usage_duration !== undefined
      && ratePlan.hourly_usage_duration !== null;

    if (!hasHourlyDetail) {
      return '钟点房必须提供最早入住时间、最晚离店时间和使用时长';
    }
  }

  return null;
}

async function ensureRoomTypeExists(roomTypeCode) {
  const result = await query('SELECT 1 FROM room_types WHERE type_code = $1', [roomTypeCode]);
  return result.rows.length > 0;
}

async function ensureNoDuplicateName(roomTypeCode, name, excludedId = null) {
  const params = [roomTypeCode, name];
  let sql = 'SELECT id FROM rate_plans WHERE room_type_code = $1 AND name = $2';

  if (excludedId) {
    params.push(excludedId);
    sql += ' AND id <> $3';
  }

  const result = await query(sql, params);
  return result.rows.length === 0;
}

async function findRatePlanById(id) {
  const result = await query(
    `
      SELECT
        rp.*,
        rt.type_name AS room_type_name,
        ocm.channel_item_id AS douyin_rate_plan_id,
        ocm.sync_status AS douyin_sync_status,
        to_char(rp.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at_text,
        to_char(rp.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at_text
      FROM rate_plans rp
      LEFT JOIN room_types rt ON rp.room_type_code = rt.type_code
      LEFT JOIN ota_channel_mappings ocm
        ON ocm.local_target_type = 'RATE_PLAN'
        AND ocm.local_target_id = rp.id
        AND ocm.channel_code = 'DOUYIN'
      WHERE rp.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

function toRatePlanResponse(row) {
  return {
    id: row.id,
    room_id: row.room_id,
    room_type_code: row.room_type_code,
    room_type_name: row.room_type_name || null,
    name: row.name,
    base_price: Number(row.base_price),
    status: row.status,
    sales_type: row.sales_type,
    currency: row.currency,
    hourly_earliest_check_in: row.hourly_earliest_check_in,
    hourly_latest_check_out: row.hourly_latest_check_out,
    hourly_usage_duration: row.hourly_usage_duration,
    midnight_latest_booking_time: row.midnight_latest_booking_time,
    midnight_enabled: row.midnight_enabled,
    douyin_config: row.douyin_config || {},
    douyin_rate_plan_id: row.douyin_rate_plan_id || null,
    douyin_sync_status: row.douyin_sync_status ?? null,
    is_synced: Boolean(row.douyin_rate_plan_id),
    created_at: row.created_at_text,
    updated_at: row.updated_at_text
  };
}

function getErrorStatusCode(error) {
  const statusCode = Number(error?.statusCode || error?.status);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600) {
    return statusCode;
  }

  return 500;
}

router.get('/', async (req, res) => {
  try {
    const roomTypeCode = normalizeString(req.query.roomTypeCode || req.query.room_type_code || '');
    const params = [];
    let whereSql = '';

    if (roomTypeCode) {
      params.push(roomTypeCode);
      whereSql = 'WHERE rp.room_type_code = $1';
    }

    const result = await query(
      `
        SELECT
          rp.*,
          rt.type_name AS room_type_name,
          ocm.channel_item_id AS douyin_rate_plan_id,
          ocm.sync_status AS douyin_sync_status,
          to_char(rp.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at_text,
          to_char(rp.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at_text
        FROM rate_plans rp
        LEFT JOIN room_types rt ON rp.room_type_code = rt.type_code
        LEFT JOIN ota_channel_mappings ocm
          ON ocm.local_target_type = 'RATE_PLAN'
          AND ocm.local_target_id = rp.id
          AND ocm.channel_code = 'DOUYIN'
        ${whereSql}
        ORDER BY rp.id DESC
      `,
      params
    );

    res.status(200).json({
      data: result.rows.map(toRatePlanResponse),
      message: '售卖套餐列表获取成功'
    });
  } catch (err) {
    console.error('获取售卖套餐列表失败:', err);
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: '套餐ID格式错误' });
    }

    const ratePlan = await findRatePlanById(id);
    if (!ratePlan) {
      return res.status(404).json({ message: '售卖套餐不存在' });
    }

    res.status(200).json({
      data: toRatePlanResponse(ratePlan),
      message: '售卖套餐获取成功'
    });
  } catch (err) {
    console.error('获取售卖套餐失败:', err);
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

router.post('/:id/douyin/sync', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: '套餐ID格式错误' });
    }

    const payload = normalizeSyncPayload(req.body || {});
    const valid = validateSyncDouyinRatePlan(payload);

    if (!valid) {
      return res.status(400).json({
        message: '请求数据格式错误',
        errors: validateSyncDouyinRatePlan.errors,
        detail: getValidationMessage(validateSyncDouyinRatePlan.errors)
      });
    }

    const existing = await findRatePlanById(id);
    if (!existing) {
      return res.status(404).json({ message: '售卖套餐不存在' });
    }

    if (existing.sales_type === 3) {
      return res.status(400).json({ message: '抖音预售券预定商品暂不支持凌晨房套餐同步' });
    }

    const douyinResult = await douyinProductService.syncProductToDouyin(id, {
      accountId: payload.accountId,
      poiId: payload.poiId
    });
    const updated = await findRatePlanById(id);

    res.status(200).json({
      data: {
        rate_plan: toRatePlanResponse(updated),
        douyin: douyinResult
      },
      message: '售卖套餐同步抖音成功'
    });
  } catch (err) {
    const statusCode = getErrorStatusCode(err);
    const log = statusCode >= 500 ? console.error : console.warn;
    log('同步售卖套餐到抖音失败:', err.message);
    if (err.douyinLogId) {
      log('抖音 logid:', err.douyinLogId);
    }
    res.status(statusCode).json({
      message: statusCode >= 500 ? '同步售卖套餐到抖音失败' : err.message,
      error: err.message,
      douyin_log_id: err.douyinLogId || null
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = normalizePayload(req.body || {});
    const valid = validateCreateRatePlan(payload);

    if (!valid) {
      return res.status(400).json({
        message: '请求数据格式错误',
        errors: validateCreateRatePlan.errors,
        detail: getValidationMessage(validateCreateRatePlan.errors)
      });
    }

    const ratePlan = {
      status: 1,
      sales_type: 1,
      currency: 'CNY',
      midnight_enabled: false,
      douyin_config: {},
      ...payload
    };

    const businessError = validateBusinessRules(ratePlan);
    if (businessError) {
      return res.status(400).json({ message: businessError });
    }

    const roomTypeExists = await ensureRoomTypeExists(ratePlan.room_type_code);
    if (!roomTypeExists) {
      return res.status(400).json({ message: '房型不存在，无法创建售卖套餐' });
    }

    const noDuplicate = await ensureNoDuplicateName(ratePlan.room_type_code, ratePlan.name);
    if (!noDuplicate) {
      return res.status(409).json({ message: '同一房型下已存在同名售卖套餐' });
    }

    const insertResult = await query(
      `
        INSERT INTO rate_plans (
          room_type_code,
          name,
          base_price,
          status,
          sales_type,
          currency,
          hourly_earliest_check_in,
          hourly_latest_check_out,
          hourly_usage_duration,
          midnight_latest_booking_time,
          midnight_enabled,
          douyin_config
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        ratePlan.room_type_code,
        ratePlan.name,
        ratePlan.base_price,
        ratePlan.status,
        ratePlan.sales_type,
        ratePlan.currency,
        ratePlan.hourly_earliest_check_in || null,
        ratePlan.hourly_latest_check_out || null,
        ratePlan.hourly_usage_duration ?? null,
        ratePlan.midnight_latest_booking_time ?? null,
        ratePlan.midnight_enabled,
        ratePlan.douyin_config
      ]
    );

    const created = await findRatePlanById(insertResult.rows[0].id);
    res.status(201).json({
      data: toRatePlanResponse(created),
      message: '售卖套餐创建成功'
    });
  } catch (err) {
    console.error('创建售卖套餐失败:', err);
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: '套餐ID格式错误' });
    }

    const payload = normalizePayload(req.body || {});
    const valid = validateUpdateRatePlan(payload);

    if (!valid) {
      return res.status(400).json({
        message: '请求数据格式错误',
        errors: validateUpdateRatePlan.errors,
        detail: getValidationMessage(validateUpdateRatePlan.errors)
      });
    }

    const existing = await findRatePlanById(id);
    if (!existing) {
      return res.status(404).json({ message: '售卖套餐不存在' });
    }

    const merged = buildMergedRatePlan(existing, payload);
    const businessError = validateBusinessRules(merged);
    if (businessError) {
      return res.status(400).json({ message: businessError });
    }

    if (payload.room_type_code !== undefined) {
      const roomTypeExists = await ensureRoomTypeExists(payload.room_type_code);
      if (!roomTypeExists) {
        return res.status(400).json({ message: '房型不存在，无法更新售卖套餐' });
      }
    }

    if (payload.room_type_code !== undefined || payload.name !== undefined) {
      const noDuplicate = await ensureNoDuplicateName(merged.room_type_code, merged.name, id);
      if (!noDuplicate) {
        return res.status(409).json({ message: '同一房型下已存在同名售卖套餐' });
      }
    }

    await query(
      `
        UPDATE rate_plans
        SET
          room_type_code = $1,
          name = $2,
          base_price = $3,
          status = $4,
          sales_type = $5,
          currency = $6,
          hourly_earliest_check_in = $7,
          hourly_latest_check_out = $8,
          hourly_usage_duration = $9,
          midnight_latest_booking_time = $10,
          midnight_enabled = $11,
          douyin_config = $12,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $13
      `,
      [
        merged.room_type_code,
        merged.name,
        merged.base_price,
        merged.status,
        merged.sales_type,
        merged.currency,
        merged.hourly_earliest_check_in || null,
        merged.hourly_latest_check_out || null,
        merged.hourly_usage_duration ?? null,
        merged.midnight_latest_booking_time ?? null,
        merged.midnight_enabled,
        merged.douyin_config || {},
        id
      ]
    );

    const updated = await findRatePlanById(id);
    res.status(200).json({
      data: toRatePlanResponse(updated),
      message: '售卖套餐更新成功'
    });
  } catch (err) {
    console.error('更新售卖套餐失败:', err);
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: '套餐ID格式错误' });
    }

    const existing = await findRatePlanById(id);
    if (!existing) {
      return res.status(404).json({ message: '售卖套餐不存在' });
    }

    const mappingResult = await query(
      'SELECT 1 FROM ota_channel_mappings WHERE local_target_type = $1 AND local_target_id = $2 LIMIT 1',
      ['RATE_PLAN', id]
    );

    if (mappingResult.rows.length > 0) {
      return res.status(400).json({ message: '套餐已同步到渠道，不能直接删除' });
    }

    await query('DELETE FROM rate_plans WHERE id = $1', [id]);
    res.status(200).json({ message: '售卖套餐删除成功' });
  } catch (err) {
    console.error('删除售卖套餐失败:', err);
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
});

module.exports = router;
