"use strict";

const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const douyinAriNotifyService = require('../services/douyinAriNotifyService');
const callbackLogService = require('../services/douyinCallbackLogService');

const router = express.Router();
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const ariNotifySchema = {
  type: 'object',
  properties: {
    localRatePlanIds: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'integer',
        minimum: 1
      }
    },
    startDate: { type: 'string', minLength: 10, maxLength: 10 },
    endDate: { type: 'string', minLength: 10, maxLength: 10 },
    accountId: { type: 'string', minLength: 1, maxLength: 64 },
    notifyScenes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'integer',
        enum: [1, 2, 3, 4]
      }
    }
  },
  required: ['localRatePlanIds', 'startDate', 'endDate'],
  additionalProperties: false
};

const validateAriNotify = ajv.compile(ariNotifySchema);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizePayload(payload = {}) {
  return {
    ...payload,
    startDate: normalizeString(payload.startDate),
    endDate: normalizeString(payload.endDate),
    accountId: normalizeString(payload.accountId)
  };
}

function getValidationMessage(errors) {
  return (errors || [])
    .map((error) => `${error.instancePath || error.schemaPath} ${error.message}`)
    .join('; ');
}

function getErrorStatusCode(error) {
  const statusCode = Number(error?.statusCode || error?.status);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600) {
    return statusCode;
  }

  return 500;
}

async function saveAriNotifyLog(record) {
  try {
    await callbackLogService.appendLog(record);
  } catch (error) {
    // 本地排障日志不能影响业务接口响应，避免文件权限问题阻断手动通知。
    console.warn('[Douyin Callback Log] 本地保存失败:', error.message);
  }
}

router.post('/', async (req, res) => {
  let payload = {};

  try {
    payload = normalizePayload(req.body || {});
    const valid = validateAriNotify(payload);

    if (!valid) {
      return res.status(400).json({
        message: '请求数据格式错误',
        errors: validateAriNotify.errors,
        detail: getValidationMessage(validateAriNotify.errors)
      });
    }

    if (new Set(payload.localRatePlanIds).size !== payload.localRatePlanIds.length) {
      return res.status(400).json({ message: 'localRatePlanIds 不能重复' });
    }

    const data = await douyinAriNotifyService.notify(payload);
    await saveAriNotifyLog({
      type: 'ari_notify',
      stage: 'processed',
      logId: data.douyinLogId,
      localRatePlanIds: payload.localRatePlanIds,
      ratePlanIds: data.ratePlanIds,
      hotelIds: data.hotelIds,
      dateRange: data.dateRange,
      notifyScenes: data.notifyScenes
    });

    return res.status(200).json({
      data,
      message: '已通知抖音拉取价量态'
    });
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    const log = statusCode >= 500 ? console.error : console.warn;
    log('通知抖音拉取价量态失败:', error.message);
    if (error.douyinLogId) {
      log('抖音 logid:', error.douyinLogId);
    }
    await saveAriNotifyLog({
      type: 'ari_notify',
      stage: 'error',
      logId: error.douyinLogId,
      localRatePlanIds: payload.localRatePlanIds,
      dateRange: {
        start: payload.startDate || '',
        end: payload.endDate || ''
      },
      statusCode,
      error: error.message
    });

    return res.status(statusCode).json({
      message: statusCode >= 500 ? '通知抖音拉取价量态失败' : error.message,
      error: error.message,
      douyin_log_id: error.douyinLogId || null
    });
  }
});

module.exports = router;
