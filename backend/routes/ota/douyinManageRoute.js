"use strict";

const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { sendDouyinError } = require('../../modules/ota/douyin/error');
const {
  createRoomSyncTasks,
  createRatePlanSyncTasks,
  getOutboxTasks,
  processOutboxTask
} = require('../../modules/ota/douyin/roomSyncService');
const {
  getAccountConfig,
  listRoomMappings,
  upsertAccountConfig,
  upsertRoomMapping
} = require('../../modules/ota/douyin/configService');

const router = express.Router();
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// 抖音房态同步任务创建参数校验规则。
const roomSyncSchema = {
  type: 'object',
  properties: {
    roomType: { type: 'string' },
    startDate: { type: 'string', format: 'date' },
    endDate: { type: 'string', format: 'date' },
    syncTypes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        enum: ['inventory', 'price']
      }
    }
  },
  required: ['startDate', 'endDate'],
  additionalProperties: false
};

// 抖音售卖房型静态信息同步任务创建参数校验规则。
const ratePlanSyncSchema = {
  type: 'object',
  properties: {
    roomType: { type: 'string' },
    ratePlanName: { type: 'string', minLength: 1, maxLength: 60 },
    active: { type: 'boolean' },
    confirmImmediately: { type: 'boolean' },
    policy: { type: 'integer' },
    settleType: { type: 'integer' },
    salesTag: { type: 'integer' },
    salesType: { type: 'integer' },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
    crowdConfig: {
      type: 'array',
      items: { type: 'integer' }
    }
  },
  additionalProperties: false
};

// 抖音账号配置保存参数校验规则。
const accountConfigSchema = {
  type: 'object',
  properties: {
    accountCode: { type: 'string' },
    clientKey: { type: 'string', minLength: 1 },
    inboundSecret: { type: 'string', minLength: 1 },
    appId: { type: 'string' },
    appSecret: { type: 'string' },
    accountId: { type: 'string' },
    hotelId: { type: 'string' },
    apiBaseUrl: { type: 'string' },
    accessToken: { type: 'string' },
    tokenExpireAt: { type: ['string', 'null'] },
    enabled: { type: 'boolean' },
    mockMode: { type: 'string', enum: ['none', 'success', 'fail'] }
  },
  required: ['clientKey', 'inboundSecret'],
  additionalProperties: false
};

// 本地房型与抖音房型映射保存参数校验规则。
const roomMappingSchema = {
  type: 'object',
  properties: {
    localRoomType: { type: 'string', minLength: 1 },
    douyinRoomId: { type: 'string', minLength: 1 },
    douyinRatePlanId: { type: 'string' },
    syncInventory: { type: 'boolean' },
    syncPrice: { type: 'boolean' },
    enabled: { type: 'boolean' }
  },
  required: ['localRoomType', 'douyinRoomId'],
  additionalProperties: false
};

// 预编译 AJV 校验器，避免每次请求重复编译规则。
const validateRoomSync = ajv.compile(roomSyncSchema);
const validateRatePlanSync = ajv.compile(ratePlanSyncSchema);
const validateAccountConfig = ajv.compile(accountConfigSchema);
const validateRoomMapping = ajv.compile(roomMappingSchema);

/**
 * 抖音房态同步任务创建接口。
 * 参数说明：请求体需满足 roomSyncSchema。
 * 返回值说明：成功返回 200，包含创建的同步任务信息。
 * 异常说明：参数不合法返回 400，业务异常统一由 sendDouyinError 输出。
 */
router.post('/room/sync', async (req, res) => {
  if (!validateRoomSync(req.body)) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: validateRoomSync.errors
    });
  }

  try {
    const result = await createRoomSyncTasks(req.body);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return sendDouyinError(res, error, '抖音房态同步任务创建失败');
  }
});

/**
 * 抖音售卖房型静态信息同步任务创建接口。
 * 参数说明：请求体需满足 ratePlanSyncSchema。
 * 返回值说明：成功返回 200，包含创建的同步任务信息。
 * 异常说明：参数不合法返回 400，业务异常统一由 sendDouyinError 输出。
 */
router.post('/room/static/sync', async (req, res) => {
  if (!validateRatePlanSync(req.body)) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: validateRatePlanSync.errors
    });
  }

  try {
    const result = await createRatePlanSyncTasks(req.body || {});
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return sendDouyinError(res, error, '抖音售卖房型同步任务创建失败');
  }
});

/**
 * 查询抖音账号配置接口。
 * 参数说明：无业务参数。
 * 返回值说明：成功返回 200，包含当前账号配置。
 * 异常说明：查询异常统一由 sendDouyinError 输出。
 */
router.get('/admin/account', async (_req, res) => {
  try {
    const config = await getAccountConfig();
    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    return sendDouyinError(res, error, '获取抖音账号配置失败');
  }
});

/**
 * 保存抖音账号配置接口。
 * 参数说明：请求体需满足 accountConfigSchema。
 * 返回值说明：成功返回 200，包含保存后的账号配置。
 * 异常说明：参数不合法返回 400，保存异常统一由 sendDouyinError 输出。
 */
router.post('/admin/account', async (req, res) => {
  if (!validateAccountConfig(req.body)) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: validateAccountConfig.errors
    });
  }

  try {
    const result = await upsertAccountConfig(req.body);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return sendDouyinError(res, error, '保存抖音账号配置失败');
  }
});

/**
 * 查询抖音房型映射列表接口。
 * 参数说明：无业务参数。
 * 返回值说明：成功返回 200，包含房型映射数组。
 * 异常说明：查询异常统一由 sendDouyinError 输出。
 */
router.get('/admin/mappings', async (_req, res) => {
  try {
    const rows = await listRoomMappings();
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    return sendDouyinError(res, error, '获取抖音房型映射失败');
  }
});

/**
 * 保存抖音房型映射接口。
 * 参数说明：请求体需满足 roomMappingSchema。
 * 返回值说明：成功返回 200，包含保存后的映射记录。
 * 异常说明：参数不合法返回 400，保存异常统一由 sendDouyinError 输出。
 */
router.post('/admin/mappings', async (req, res) => {
  if (!validateRoomMapping(req.body)) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: validateRoomMapping.errors
    });
  }

  try {
    const row = await upsertRoomMapping(req.body);
    return res.status(200).json({
      success: true,
      data: row
    });
  } catch (error) {
    return sendDouyinError(res, error, '保存抖音房型映射失败');
  }
});

/**
 * 查询抖音出站任务列表接口。
 * 参数说明：无业务参数。
 * 返回值说明：成功返回 200，包含待同步/失败任务列表。
 * 异常说明：查询异常统一由 sendDouyinError 输出。
 */
router.get('/admin/outbox', async (_req, res) => {
  try {
    const rows = await getOutboxTasks();
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    return sendDouyinError(res, error, '获取抖音同步任务失败');
  }
});

/**
 * 重试抖音出站任务接口。
 * 参数说明：路径参数 id 为正整数任务 ID。
 * 返回值说明：成功返回 200，包含任务重试结果。
 * 异常说明：id 非法返回 400，执行异常统一由 sendDouyinError 输出。
 */
router.post('/admin/outbox/:id/retry', async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        success: false,
        message: '任务 ID 不合法'
      });
    }

    const result = await processOutboxTask(taskId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return sendDouyinError(res, error, '重试抖音同步任务失败');
  }
});

module.exports = router;
