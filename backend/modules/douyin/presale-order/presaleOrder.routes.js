"use strict";

const express = require('express');
const repository = require('./presaleOrder.repository');

const router = express.Router();

/** 返回抖音预售券主订单，避免与普通入住订单混在同一列表。 */
router.get('/', async (_req, res) => {
  try {
    const orders = await repository.listOrders();
    return res.status(200).json({ data: orders, message: '抖音预售订单列表获取成功' });
  } catch (error) {
    console.error('[Douyin Presale Order] 获取订单列表失败:', { error: error.message });
    return res.status(500).json({ message: '获取抖音预售订单失败' });
  }
});

module.exports = router;
