"use strict";

const express = require('express');

const router = express.Router();

/**
 * 返回飞猪接口未实现响应。
 * @param {import('express').Request} _req 请求对象
 * @param {import('express').Response} res 响应对象
 * @returns {import('express').Response} Express 响应
 */
function notImplemented(_req, res) {
  return res.status(501).json({
    success: false,
    message: '飞猪直连能力尚未实现',
    error: {
      code: 'FLIGGY_NOT_IMPLEMENTED'
    }
  });
}

router.post('/order/create', notImplemented);
router.post('/order/cancel', notImplemented);
router.post('/room/sync', notImplemented);

module.exports = router;
