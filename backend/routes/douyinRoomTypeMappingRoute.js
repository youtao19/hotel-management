const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const db = require('../database/postgreDB/pg');
const roomStaticInfoService = require('../services/selfMatchRoomStaticInfo');

const router = express.Router();
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const syncOptionsSchema = {
  type: 'object',
  properties: {
    accountId: { type: 'string', minLength: 1, maxLength: 64 },
    poiId: { type: 'string', minLength: 1, maxLength: 64 }
  },
  additionalProperties: false
};

const saveMappingsSchema = {
  type: 'object',
  properties: {
    mappings: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          localRoomType: { type: 'string', minLength: 1, maxLength: 255 },
          douyinRoomId: { type: 'string', minLength: 1, maxLength: 64 }
        },
        required: ['localRoomType', 'douyinRoomId'],
        additionalProperties: false
      }
    }
  },
  required: ['mappings'],
  additionalProperties: false
};

const validateSyncOptions = ajv.compile(syncOptionsSchema);
const validateSaveMappings = ajv.compile(saveMappingsSchema);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeOptions(payload = {}) {
  return {
    accountId: normalizeString(payload.accountId),
    poiId: normalizeString(payload.poiId)
  };
}

function normalizeMappings(payload = {}) {
  return {
    mappings: Array.isArray(payload.mappings)
      ? payload.mappings.map((item) => ({
        localRoomType: normalizeString(item.localRoomType),
        douyinRoomId: normalizeString(item.douyinRoomId)
      }))
      : payload.mappings
  };
}

function getValidationMessage(errors) {
  return (errors || [])
    .map((error) => `${error.instancePath || error.schemaPath} ${error.message}`)
    .join('; ');
}

function getMatchStatus(row) {
  if (!row.douyin_room_id) {
    return 'UNMATCHED';
  }

  if (!row.cached_room_id) {
    return 'MATCHED_BUT_ROOM_CACHE_MISSING';
  }

  if (Number(row.douyin_room_status) === 0 || row.douyin_room_active === 'false') {
    return 'DOUYIN_ROOM_INACTIVE';
  }

  return 'MATCHED';
}

function toMappingItem(row) {
  const matchStatus = getMatchStatus(row);

  return {
    localRoomType: row.type_code,
    localRoomTypeName: row.type_name,
    localBasePrice: Number(row.base_price || 0),
    douyinRoomId: row.douyin_room_id || null,
    douyinRoomName: row.douyin_room_name || row.cached_room_name || null,
    cachedRoomName: row.cached_room_name || null,
    douyinRoomStatus: row.douyin_room_status,
    douyinRoomActive: row.douyin_room_active,
    matchStatus,
    isMatched: matchStatus === 'MATCHED',
    updatedAt: row.mapping_updated_at
  };
}

function toDouyinRoomItem(row) {
  return {
    roomId: row.room_id,
    roomName: row.room_name,
    status: row.status,
    active: row.active,
    accountId: row.account_id,
    hotelId: row.hotel_id,
    boundLocalRoomType: row.bound_local_room_type || null,
    boundLocalRoomTypeName: row.bound_local_room_type_name || null,
    updatedAt: row.updated_at
  };
}

async function getMappingPageData() {
  const mappingResult = await db.query(
    `
      SELECT
        rt.type_code,
        rt.type_name,
        rt.base_price,
        drm.douyin_room_id,
        drm.douyin_room_name,
        drm.updated_at AS mapping_updated_at,
        dpr.room_id AS cached_room_id,
        dpr.room_name AS cached_room_name,
        dpr.status AS douyin_room_status,
        dpr.raw_payload ->> 'active' AS douyin_room_active
      FROM room_types rt
      LEFT JOIN douyin_room_type_mapping drm
        ON drm.local_room_type = rt.type_code
      LEFT JOIN douyin_physical_rooms dpr
        ON dpr.room_id = drm.douyin_room_id
      ORDER BY rt.type_code
    `
  );

  const roomResult = await db.query(
    `
      SELECT
        dpr.room_id,
        dpr.room_name,
        dpr.status,
        dpr.raw_payload ->> 'active' AS active,
        dpr.account_id,
        COALESCE(
          dpr.raw_payload ->> 'hotel_id',
          dpr.raw_payload ->> 'poi_id',
          dpr.raw_payload ->> 'hotelId',
          dpr.raw_payload ->> 'poiId',
          dpr.raw_payload -> 'hotel' ->> 'hotel_id'
        ) AS hotel_id,
        drm.local_room_type AS bound_local_room_type,
        rt.type_name AS bound_local_room_type_name,
        to_char(dpr.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      FROM douyin_physical_rooms dpr
      LEFT JOIN douyin_room_type_mapping drm
        ON drm.douyin_room_id = dpr.room_id
      LEFT JOIN room_types rt
        ON rt.type_code = drm.local_room_type
      ORDER BY dpr.room_name NULLS LAST, dpr.room_id
    `
  );

  const items = mappingResult.rows.map(toMappingItem);
  const matchedCount = items.filter((item) => item.matchStatus === 'MATCHED').length;

  return {
    summary: {
      localRoomTypeCount: items.length,
      matchedCount,
      unmatchedCount: items.length - matchedCount,
      douyinRoomCount: roomResult.rows.length
    },
    items,
    douyinRooms: roomResult.rows.map(toDouyinRoomItem)
  };
}

async function ensureMappingsCanBeSaved(client, mappings) {
  const localTypes = mappings.map((item) => item.localRoomType);
  const douyinRoomIds = mappings.map((item) => item.douyinRoomId);

  if (new Set(localTypes).size !== localTypes.length) {
    const error = new Error('同一个请求内不能重复绑定本地房型');
    error.statusCode = 400;
    throw error;
  }

  if (new Set(douyinRoomIds).size !== douyinRoomIds.length) {
    const error = new Error('同一个请求内不能重复绑定抖音房型');
    error.statusCode = 400;
    throw error;
  }

  const localResult = await client.query(
    'SELECT type_code FROM room_types WHERE type_code = ANY($1)',
    [localTypes]
  );
  const existingLocalTypes = new Set(localResult.rows.map((row) => row.type_code));
  const missingLocalType = localTypes.find((typeCode) => !existingLocalTypes.has(typeCode));
  if (missingLocalType) {
    const error = new Error(`本地房型不存在：${missingLocalType}`);
    error.statusCode = 400;
    throw error;
  }

  const roomResult = await client.query(
    'SELECT room_id FROM douyin_physical_rooms WHERE room_id = ANY($1)',
    [douyinRoomIds]
  );
  const existingRoomIds = new Set(roomResult.rows.map((row) => row.room_id));
  const missingRoomId = douyinRoomIds.find((roomId) => !existingRoomIds.has(roomId));
  if (missingRoomId) {
    const error = new Error(`抖音物理房型缓存不存在，请先刷新抖音房型：${missingRoomId}`);
    error.statusCode = 400;
    throw error;
  }

  const conflictResult = await client.query(
    'SELECT local_room_type, douyin_room_id FROM douyin_room_type_mapping WHERE douyin_room_id = ANY($1)',
    [douyinRoomIds]
  );
  const localTypeSet = new Set(localTypes);
  const conflict = conflictResult.rows.find((row) => !localTypeSet.has(row.local_room_type));
  if (conflict) {
    const error = new Error(`抖音房型 ${conflict.douyin_room_id} 已绑定本地房型 ${conflict.local_room_type}`);
    error.statusCode = 400;
    throw error;
  }
}

router.get('/', async (_req, res) => {
  try {
    const data = await getMappingPageData();
    res.status(200).json({
      data,
      message: '抖音房型匹配列表获取成功'
    });
  } catch (error) {
    console.error('获取抖音房型匹配列表失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const payload = normalizeOptions(req.body || {});
    const valid = validateSyncOptions(payload);
    if (!valid) {
      return res.status(400).json({
        message: '请求数据格式错误',
        errors: validateSyncOptions.errors,
        detail: getValidationMessage(validateSyncOptions.errors)
      });
    }

    const refreshResult = await roomStaticInfoService.refreshPhysicalRoomsFromDouyin(payload);
    const pageData = await getMappingPageData();

    res.status(200).json({
      data: {
        refresh: refreshResult,
        ...pageData
      },
      message: `已刷新 ${refreshResult.savedCount} 个抖音物理房型`
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    const log = statusCode >= 500 ? console.error : console.warn;
    log('刷新抖音物理房型失败:', error.message);
    if (error.douyinLogId) {
      log('抖音 logid:', error.douyinLogId);
    }
    res.status(statusCode).json({
      message: statusCode >= 500 ? '刷新抖音物理房型失败' : error.message,
      error: error.message,
      douyin_log_id: error.douyinLogId || null
    });
  }
});

router.post('/', async (req, res) => {
  let client;
  try {
    const payload = normalizeMappings(req.body || {});
    const valid = validateSaveMappings(payload);
    if (!valid) {
      return res.status(400).json({
        message: '请求数据格式错误',
        errors: validateSaveMappings.errors,
        detail: getValidationMessage(validateSaveMappings.errors)
      });
    }

    client = await db.getClient();
    await client.query('BEGIN');

    await ensureMappingsCanBeSaved(client, payload.mappings);

    const localTypes = payload.mappings.map((item) => item.localRoomType);
    await client.query('DELETE FROM douyin_room_type_mapping WHERE local_room_type = ANY($1)', [localTypes]);

    for (const mapping of payload.mappings) {
      const roomResult = await client.query(
        'SELECT room_name FROM douyin_physical_rooms WHERE room_id = $1',
        [mapping.douyinRoomId]
      );
      const douyinRoomName = roomResult.rows[0]?.room_name || mapping.douyinRoomId;

      await client.query(
        `
          INSERT INTO douyin_room_type_mapping
            (douyin_room_id, douyin_room_name, local_room_type)
          VALUES ($1, $2, $3)
        `,
        [mapping.douyinRoomId, douyinRoomName, mapping.localRoomType]
      );
    }

    await client.query('COMMIT');

    const data = await getMappingPageData();
    res.status(200).json({
      data,
      message: '抖音房型匹配保存成功'
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    const statusCode = Number(error.statusCode || 500);
    const log = statusCode >= 500 ? console.error : console.warn;
    log('保存抖音房型匹配失败:', error.message);
    res.status(statusCode).json({
      message: statusCode >= 500 ? '保存抖音房型匹配失败' : error.message,
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.delete('/:localRoomType', async (req, res) => {
  try {
    const localRoomType = normalizeString(req.params.localRoomType || '');
    if (!localRoomType) {
      return res.status(400).json({ message: '本地房型编码不能为空' });
    }

    const result = await db.query(
      'DELETE FROM douyin_room_type_mapping WHERE local_room_type = $1 RETURNING *',
      [localRoomType]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '抖音房型匹配不存在' });
    }

    const data = await getMappingPageData();
    res.status(200).json({
      data,
      message: '抖音房型匹配已解除'
    });
  } catch (error) {
    console.error('解除抖音房型匹配失败:', error);
    res.status(500).json({ message: '解除抖音房型匹配失败', error: error.message });
  }
});

module.exports = router;
