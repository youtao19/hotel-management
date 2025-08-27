"use strict";
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const billModule = require('../modules/billModule');

// 创建账单
router.post('/create', [
    body('order_id').notEmpty().withMessage('订单ID不能为空'),
    body('room_number').notEmpty().withMessage('房间号不能为空'),
    body('guest_name').notEmpty().withMessage('客人姓名不能为空'),
  // deposit/room_fee/total_income/pay_way 可选：多日账单场景下可能仅更新 orders 表
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

  const { order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, remarks } = req.body;

    // 允许同一订单创建多个账单（多日账单场景）；不再按 order_id 阻止重复

    // 规范化与校验字段类型
    const parsedDeposit = Number(deposit) || 0;
    const parsedRoomFee = Number(room_fee) || 0;
    const parsedTotalIncome = Number(total_income) || 0;

    // 兼容旧字段 refund_deposit（如果传了，仍按非正数校验；新流程退押已单独写入 change 记录）
    let normalizedRefundDeposit = 0;
    if (refund_deposit !== undefined) {
      const n = Number(refund_deposit) || 0;
      if (n > 0) return res.status(400).json({ message: '已退押金不能为正数' });
      normalizedRefundDeposit = n;
    }

  // 支付方式兼容：支持对象 { value } 或字符串（可选）
  const way = pay_way === undefined ? '' : (typeof pay_way === 'object' ? (pay_way?.value ?? pay_way?.label ?? '') : String(pay_way || ''));

    try {
        console.log('收到账单数据', req.body)
        console.log('标准化字段 -> deposit:', parsedDeposit, ' room_fee:', parsedRoomFee, ' total_income:', parsedTotalIncome, ' refund_deposit:', normalizedRefundDeposit, ' pay_way:', way)
  const bill = await billModule.createBill(order_id, room_number, guest_name, parsedDeposit, normalizedRefundDeposit, parsedRoomFee, parsedTotalIncome, way, remarks);
        console.log('账单创建结果', bill)
        if (bill && bill.skippedInsert) {
            // 多日账单场景：未在 bills 表插入，返回订单更新信息
            return res.status(200).json({ message: '账单已处理（未在 bills 插入，多日订单已更新 orders）', result: bill });
        }
        res.status(201).json({ message: '账单创建成功', bill });
    } catch (error) {
        res.status(500).json({ message: '创建账单失败', error: error.message });
    }
});

// 获取所有账单
router.get('/all', async (req, res) => {
  try {
    const bills = await billModule.getAllBills();
    res.status(200).json({ message: '获取所有账单成功', bills });
  } catch (error) {
    console.error('获取所有账单失败:', error);
    res.status(500).json({ message: '获取所有账单失败', error: error.message });
  }
});


// 获取某订单的全部账单
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const bills = await billModule.getBillsByOrderId(orderId);
    res.status(200).json({ message: '获取订单账单成功', bills });
  } catch (error) {
    console.error('获取订单账单失败:', error);
    res.status(500).json({ message: '获取订单账单失败', error: error.message });
  }
});

// 兼容旧接口：获取某订单最新一条账单 (这个要放在最后，因为它使用参数化路由)
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const bill = await billModule.getBillByOrderId(orderId);
    res.status(200).json({ message: '账单获取成功', bill });
  } catch (error) {
    res.status(500).json({ message: '获取账单失败', error: error.message });
  }
});



module.exports = router;
