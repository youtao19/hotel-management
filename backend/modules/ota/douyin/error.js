"use strict";

/**
 * 创建抖音 OTA 业务异常。
 * @param {string} message 异常说明
 * @param {string} code 业务错误码
 * @param {number} statusCode HTTP 状态码
 * @param {object|null} details 补充上下文
 * @returns {Error} 业务异常
 */
function createDouyinError(message, code, statusCode = 400, details = null) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
}

/**
 * 将异常输出为统一响应格式。
 * @param {import('express').Response} res 响应对象
 * @param {Error} error 业务异常
 * @param {string} fallbackMessage 兜底文案
 * @returns {import('express').Response} Express 响应
 */
function sendDouyinError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? fallbackMessage : error.message,
    error: {
      code: error.code || 'DOUYIN_UNKNOWN_ERROR',
      details: error.details || null
    }
  });
}

module.exports = {
  createDouyinError,
  sendDouyinError
};
