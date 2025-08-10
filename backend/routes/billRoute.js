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
    body('deposit').notEmpty().withMessage('押金不能为空'),
    body('refund_deposit').notEmpty().withMessage('退押金状态不能为空'),
    body('room_fee').notEmpty().withMessage('房费不能为空'),
    body('total_income').notEmpty().withMessage('总收入不能为空'),
    body('pay_way').notEmpty().withMessage('支付方式不能为空'),
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

    // refund_deposit 字段为数值：0（未退）或负数（已退金额）
    let normalizedRefundDeposit = 0;
    if (typeof refund_deposit === 'number') {
      normalizedRefundDeposit = refund_deposit;
    } else if (typeof refund_deposit === 'string') {
      const lower = refund_deposit.toLowerCase();
      if (lower === 'no' || lower === '未退' || lower === 'false') {
        normalizedRefundDeposit = 0;
      } else if (!isNaN(parseFloat(refund_deposit))) {
        normalizedRefundDeposit = parseFloat(refund_deposit);
      } else {
        // 默认按未退处理
        normalizedRefundDeposit = 0;
      }
    }

    if (normalizedRefundDeposit > 0) {
      return res.status(400).json({ message: '已退押金不能为正数' });
    }

    // 支付方式兼容：支持对象 { value } 或字符串
    const way = typeof pay_way === 'object' ? (pay_way?.value ?? pay_way?.label ?? '') : String(pay_way || '');
    if (!way) {
      return res.status(400).json({ message: '支付方式无效' });
    }

    try {
        console.log('收到账单数据', req.body)
        console.log('标准化字段 -> deposit:', parsedDeposit, ' room_fee:', parsedRoomFee, ' total_income:', parsedTotalIncome, ' refund_deposit:', normalizedRefundDeposit, ' pay_way:', way)
        const bill = await billModule.createBill(order_id, room_number, guest_name, parsedDeposit, normalizedRefundDeposit, parsedRoomFee, parsedTotalIncome, way, remarks);
        console.log('账单创建成功',bill)
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


// 获得账单 (这个要放在最后，因为它使用参数化路由)
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
