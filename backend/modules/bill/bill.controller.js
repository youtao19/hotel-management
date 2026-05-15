"use strict";

const billService = require("./bill.service");
const billValidator = require("./bill.validator");
const orderManageService = require("../order-manage/orderManage.service");

function validationError(res, errors) {
  return res.status(400).json({ message: '请求数据格式不正确', errors });
}

async function getAllBills(_req, res) {
  try {
    const bills = await billService.getAllBills();
    res.json({ bills });
  } catch (err) {
    res.status(500).json({ message: '获取所有账单失败', error: err.message });
  }
}

async function addBill(req, res) {
  try {
    const errors = billValidator.validateRequest(billValidator.validateAddBill, req.body);
    if (errors) return validationError(res, errors);

    const orderRows = await orderManageService.getOrder(req.body.order_id);
    const order = orderRows && orderRows.length ? orderRows[0] : {};
    const newBill = await billService.addBill({
      ...req.body,
      pay_way: req.body.pay_way || req.body.method,
      remarks: req.body.remarks || req.body.notes || null,
      room_number: order.room_number || null,
      guest_name: order.guest_name || null,
      stay_type: order.stay_type || null,
      create_time: req.body.create_time || req.body.refundTime || null
    });
    res.status(201).json({ success: true, data: newBill });
  } catch (err) {
    res.status(500).json({ message: '添加账单失败', error: err.message });
  }
}

async function createOtherIncome(req, res) {
  try {
    const errors = billValidator.validateRequest(billValidator.validateOtherIncome, req.body);
    if (errors) return validationError(res, errors);

    const newBill = await billService.createOtherIncome(req.body);
    res.status(201).json({ success: true, data: newBill });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || '添加其他收入失败', error: err.message });
  }
}

async function getBillsByOrderId(req, res) {
  try {
    const bills = await billService.getBillsByOrderId(req.params.orderId);
    res.json({ data: bills });
  } catch (err) {
    res.status(500).json({ message: '服务器错误', error: err.message });
  }
}

async function getOrderBillDetails(req, res) {
  try {
    const billDetails = await billService.getOrderBillDetails(req.params.orderId);
    res.json({ success: true, data: billDetails });
  } catch (err) {
    res.status(500).json({ message: '获取订单账单详情失败', error: err.message });
  }
}

async function updateBill(req, res) {
  try {
    const updatedBill = await billService.updateBill(req.params.billId, req.body);
    if (!updatedBill) {
      return res.status(404).json({ message: '账单不存在' });
    }
    res.json({ success: true, data: updatedBill });
  } catch (err) {
    res.status(500).json({ message: '更新账单失败', error: err.message });
  }
}

async function getBillsByDate(req, res) {
  try {
    const data = await billService.getBillsByDate(req.params.date);
    res.json({
      success: true,
      data,
      message: `成功获取 ${req.params.date} 的账单数据`
    });
  } catch (err) {
    console.error('获取指定日期账单失败:', err);
    res.status(500).json({
      success: false,
      message: '获取指定日期账单失败',
      error: err.message
    });
  }
}

async function adjustment(req, res) {
  try {
    const errors = billValidator.validateRequest(billValidator.validateAddBill, req.body);
    if (errors) return validationError(res, errors);

    const orderRows = await orderManageService.getOrder(req.body.order_id);
    if (!orderRows || orderRows.length === 0) {
      return res.status(400).json({ message: `订单号 '${req.body.order_id}' 不存在，无法调整金额` });
    }

    const order = orderRows[0];
    const newBill = await billService.addBill({
      ...req.body,
      room_number: order.room_number,
      pay_way: req.body.pay_way || req.body.method,
      remarks: req.body.remarks || req.body.notes || null,
      guest_name: order.guest_name,
      stay_type: order.stay_type,
      stay_date: null,
      create_time: req.body.create_time || null
    });
    res.status(201).json({ success: true, data: newBill });
  } catch (err) {
    res.status(500).json({ message: '金额调整失败', error: err.message });
  }
}

module.exports = {
  getAllBills,
  addBill,
  createOtherIncome,
  getBillsByOrderId,
  getOrderBillDetails,
  updateBill,
  getBillsByDate,
  adjustment
};
