"use strict";

const { toAmountNumber, formatDate } = require("../tools");
const billRepository = require("./bill.repository");

const REFUND_TYPES = new Set(['退押', '退押金', '退款']);
const PAY_WAY_KEYS = ['现金', '微信', '微邮付', '其他'];

function normalizeSignedAmount(changeType, amount) {
  const value = toAmountNumber(amount);
  if (changeType === '退款' || changeType === '退押') {
    return -Math.abs(value);
  }
  if (changeType === '补收' || changeType === '收押') {
    return Math.abs(value);
  }
  return value;
}

function normalizePayWayForSummary(value) {
  return PAY_WAY_KEYS.includes(value) ? value : '其他';
}

function addAmount(bucket, payWay, amount) {
  const key = normalizePayWayForSummary(payWay);
  const cents = Math.round((Number(amount) || 0) * 100);
  bucket[key] = Number(((bucket[key] || 0) + cents).toFixed(0));
}

function createPaywayBucket() {
  return PAY_WAY_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
}

function toAmountBucket(bucketCents) {
  const result = {};
  PAY_WAY_KEYS.forEach((key) => {
    result[key] = Number(((bucketCents[key] || 0) / 100).toFixed(2));
  });
  return result;
}

async function getBillByOrderId(orderId) {
  try {
    return await billRepository.getBillByOrderId(orderId);
  } catch (error) {
    console.error('获得账单数据库错误:', error);
    throw error;
  }
}

async function getBillsByOrderId(orderId) {
  try {
    return await billRepository.getBillsByOrderId(orderId);
  } catch (error) {
    console.error('获取订单全部账单数据库错误:', error);
    throw error;
  }
}

async function getAllBills() {
  try {
    return await billRepository.getAllBills();
  } catch (error) {
    console.error('获取所有账单数据库错误:', error);
    throw error;
  }
}

async function addBill(billData, client) {
  try {
    const normalized = {
      ...billData,
      change_price: normalizeSignedAmount(billData.change_type, billData.change_price)
    };
    return await billRepository.insertBill(normalized, client);
  } catch (error) {
    console.error('添加账单失败:', error);
    throw error;
  }
}

async function applyDepositRefund(orderId, actualRefundAmount, refundMethod, refundTime) {
  if (!orderId || !actualRefundAmount || actualRefundAmount <= 0) return null;
  try {
    return await billRepository.insertDepositRefund(
      orderId,
      actualRefundAmount,
      refundMethod,
      refundTime
    );
  } catch (error) {
    console.error('应用押金退款(写入退押记录)失败:', error);
    throw error;
  }
}

async function getOrderBillDetails(orderId) {
  try {
    const rows = await billRepository.getOrderBillDetails(orderId);
    const dateMap = new Map();

    for (const row of rows) {
      const dateKey = formatDate(row.stay_date);

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          stay_date: dateKey,
          room_fee: 0,
          deposit: 0,
          change_price: 0,
          change_type: '订单账单',
          pay_way: row.pay_way,
          create_time: row.create_time,
          remarks: row.remarks
        });
      }

      const dateData = dateMap.get(dateKey);
      if (row.change_type === '房费') {
        dateData.room_fee += Number(row.change_price || 0);
      } else if (row.change_type === '收押') {
        dateData.deposit += Number(row.change_price || 0);
      } else if (row.change_type === '订单账单') {
        dateData.room_fee += Number(row.change_price || 0);
      }
    }

    return Array.from(dateMap.values());
  } catch (error) {
    console.error('获取订单账单详情数据库错误:', error);
    throw error;
  }
}

async function updateBill(billId, updateData) {
  try {
    const originalBill = await billRepository.findBillById(billId);
    if (!originalBill) {
      throw new Error(`账单 ${billId} 不存在`);
    }

    const nextChangeType = Object.prototype.hasOwnProperty.call(updateData, 'change_type')
      ? updateData.change_type
      : originalBill.change_type;
    const nextData = { ...updateData };

    if (REFUND_TYPES.has(nextChangeType)) {
      const priceSource = Object.prototype.hasOwnProperty.call(nextData, 'change_price')
        ? nextData.change_price
        : originalBill.change_price;
      nextData.change_price = -Math.abs(Number(priceSource) || 0);
    } else if (Object.prototype.hasOwnProperty.call(nextData, 'change_price')) {
      const parsed = Number(nextData.change_price);
      nextData.change_price = Number.isNaN(parsed) ? 0 : parsed;
    }

    const updateFields = [];
    const values = [];
    const allowedFields = ['change_price', 'change_type', 'pay_way', 'remarks'];

    allowedFields.forEach((field) => {
      if (nextData[field] !== undefined && nextData[field] !== originalBill[field]) {
        updateFields.push(`${field} = $${values.length + 1}`);
        values.push(nextData[field]);
      }
    });

    if (!updateFields.length) {
      return originalBill;
    }

    return await billRepository.updateBillFields(billId, updateFields, values);
  } catch (error) {
    console.error('更新账单失败:', error);
    throw error;
  }
}

async function createOtherIncome(payload) {
  const numericAmount = Number(payload.amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    const error = new Error('amount 必须是大于 0 的数字');
    error.statusCode = 400;
    throw error;
  }

  return billRepository.insertOtherIncome({
    ...payload,
    amount: numericAmount
  });
}

async function getBillsByDate(date) {
  const rows = await billRepository.listBillsByDate(date);
  const allBills = rows.map((bill) => ({
    bill_id: bill.bill_id,
    order_id: bill.order_id,
    stay_date: bill.stay_date,
    stay_type: bill.stay_type,
    change_type: bill.change_type,
    change_price: Number(bill.change_price || 0),
    pay_way: bill.pay_way,
    create_time: bill.create_time,
    room_number: bill.room_number,
    guest_name: bill.guest_name,
    phone: bill.phone,
    order_status: bill.order_status
  }));

  const hotelBills = allBills.filter((bill) => bill.stay_type === '客房');
  const restBills = allBills.filter((bill) => bill.stay_type === '休息房');
  const carBills = allBills.filter((bill) =>
    bill.stay_type === '租车收入' ||
    bill.change_type === '租车收入' ||
    (!bill.order_id && (bill.stay_type === '其他' || !bill.stay_type))
  );

  const bucketsCents = {
    hotelIncome: createPaywayBucket(),
    restIncome: createPaywayBucket(),
    hotelRefundDeposit: createPaywayBucket(),
    restRefundDeposit: createPaywayBucket(),
    carRentIncome: createPaywayBucket()
  };

  const isRefund = (type) => ['退押', '退押金', '退款'].includes(type);
  const isIncome = (type) => ['房费', '收押', '补收', '订单账单', '租车收入'].includes(type);
  const accumulate = (items, incomeBucket, refundBucket) => {
    items.forEach((bill) => {
      if (isIncome(bill.change_type)) {
        addAmount(bucketsCents[incomeBucket], bill.pay_way, bill.change_price);
      } else if (isRefund(bill.change_type)) {
        addAmount(bucketsCents[refundBucket], bill.pay_way, Math.abs(bill.change_price));
      }
    });
  };

  accumulate(hotelBills, 'hotelIncome', 'hotelRefundDeposit');
  accumulate(restBills, 'restIncome', 'restRefundDeposit');
  accumulate(carBills, 'carRentIncome', 'carRentIncome');

  return {
    hotelBills,
    restBills,
    carBills,
    summaryDataObject: {
      hotelIncome: toAmountBucket(bucketsCents.hotelIncome),
      restIncome: toAmountBucket(bucketsCents.restIncome),
      hotelRefundDeposit: toAmountBucket(bucketsCents.hotelRefundDeposit),
      restRefundDeposit: toAmountBucket(bucketsCents.restRefundDeposit),
      carRentIncome: toAmountBucket(bucketsCents.carRentIncome),
      totalRooms: hotelBills.length,
      restRooms: restBills.length
    },
    totalCount: allBills.length
  };
}

module.exports = {
  getBillByOrderId,
  getBillsByOrderId,
  getAllBills,
  applyDepositRefund,
  addBill,
  getOrderBillDetails,
  updateBill,
  createOtherIncome,
  getBillsByDate
};
