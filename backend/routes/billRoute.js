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

    // 检查账单是否存在
    const bill = await billModule.getBillByOrderId(order_id);
    if(bill){
        return res.status(400).json({ message: '账单已存在，请勿重复创建' });
    }

     // 转换 refund_deposit 从字符串到布尔值
     let refund_deposit_bool = true;
     if(refund_deposit === 'yes'){
        refund_deposit_bool = true;
    }else{
        refund_deposit_bool = false;
    }

    const way = pay_way.value

    try {
        console.log('收到账单数据',req.body)
        console.log('way:',way)
        const bill = await billModule.createBill(order_id, room_number, guest_name, deposit, refund_deposit_bool, room_fee, total_income, way, remarks);
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

// 获取待邀请好评的账单
router.get('/pending-invitations', async (req, res) => {
  try {
    const bills = await billModule.getPendingReviewInvitations();
    res.status(200).json({ message: '获取待邀请好评账单成功', bills });
  } catch (error) {
    console.error('获取待邀请好评账单失败:', error);
    res.status(500).json({ message: '获取待邀请好评账单失败', error: error.message });
  }
});

// 获取已邀请但未设置好评状态的账单
router.get('/pending-reviews', async (req, res) => {
  try {
    const bills = await billModule.getPendingReviewUpdates();
    res.status(200).json({ message: '获取待更新好评状态账单成功', bills });
  } catch (error) {
    console.error('获取待更新好评状态账单失败:', error);
    res.status(500).json({ message: '获取待更新好评状态账单失败', error: error.message });
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

// 邀请客户好评
router.post('/:orderId/invite-review', async (req, res) => {
  try {
    const { orderId } = req.params;

    // 检查账单是否存在
    const existingBill = await billModule.getBillByOrderId(orderId);
    if (!existingBill) {
      return res.status(404).json({ message: '账单不存在' });
    }

    // 检查是否已经邀请过
    if (existingBill.review_invited) {
      return res.status(400).json({ message: '已经邀请过好评，请勿重复操作' });
    }

    const updatedBill = await billModule.inviteReview(orderId);
    res.status(200).json({
      message: '好评邀请发送成功',
      bill: updatedBill
    });
  } catch (error) {
    console.error('邀请好评失败:', error);
    res.status(500).json({ message: '邀请好评失败', error: error.message });
  }
});

// 更新好评状态
router.post('/:orderId/review-status', [
  body('positive_review')
    .isBoolean()
    .withMessage('好评状态必须是布尔值')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { orderId } = req.params;
    const { positive_review } = req.body;

    // 检查账单是否存在
    const existingBill = await billModule.getBillByOrderId(orderId);
    if (!existingBill) {
      return res.status(404).json({ message: '账单不存在' });
    }

    // 检查是否已经邀请过好评
    if (!existingBill.review_invited) {
      return res.status(400).json({ message: '尚未邀请好评，无法设置好评状态' });
    }

    const updatedBill = await billModule.updateReviewStatus(orderId, positive_review);
    res.status(200).json({
      message: '好评状态更新成功',
      bill: updatedBill
    });
  } catch (error) {
    console.error('更新好评状态失败:', error);
    res.status(500).json({ message: '更新好评状态失败', error: error.message });
  }
});

module.exports = router;
