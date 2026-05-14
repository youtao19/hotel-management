const orderManageService = require('./orderManage.service');
const {
  normalizeOrderListFilters,
  validateEarlyCheckout,
  validateUpdateOrderStatus
} = require('./orderManage.validator');

/**
 * 给订单列表页提供聚合后的订单数据。
 * 搜索、状态和日期筛选统一在后端处理，前端只传筛选条件。
 */
async function listOrders(req, res) {
  try {
    const { filters, error } = normalizeOrderListFilters(req.query || {});
    if (error) {
      return res.status(400).json({
        message: error.message,
        error: error.code
      });
    }

    const orders = await orderManageService.listOrders(filters);
    console.log(`成功获取 ${orders.length} 条订单数据`);
    return res.status(200).json({ data: orders });
  } catch (err) {
    console.error('获取订单数据错误:', err);
    return res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
}

/**
 * 给每日房间安排页提供按入住日期拆开的订单明细。
 * 多日订单会返回每天一条记录，用于前端按天排房和换房。
 */
async function listDailyOrders(req, res) {
  try {
    console.log('获取所有订单每日明细请求');
    const orders = await orderManageService.listDailyOrders();
    console.log(`成功获取 ${orders.length} 条每日明细数据`);
    return res.status(200).json({ data: orders });
  } catch (err) {
    console.error('获取订单每日明细错误:', err);
    return res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
}

/**
 * 给订单详情和编辑页读取一笔订单的所有日记录。
 * 多日订单仍沿用数组响应，避免改动现有前端展示口径。
 */
async function getOrder(req, res) {
  try {
    const { id } = req.params;
    console.log(`获取订单ID: ${id}`);

    const order = await orderManageService.getOrder(id);
    if (!order) {
      return res.status(404).json({ message: '未找到订单' });
    }

    return res.json({ data: order });
  } catch (err) {
    console.error('获取订单数据错误:', err);
    return res.status(500).json({
      message: '服务器错误',
      error: err.message,
      stack: process.env.NODE_ENV === 'dev' ? err.stack : undefined
    });
  }
}

/**
 * 修改订单状态。
 * 多日订单状态变更由 service 覆盖同一 order_id 下所有日记录。
 */
async function updateOrderStatus(req, res) {
  try {
    const valid = validateUpdateOrderStatus(req.body);
    if (!valid) {
      console.error('更新订单状态请求参数验证失败:', validateUpdateOrderStatus.errors);
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validateUpdateOrderStatus.errors
      });
    }

    const { orderNumber } = req.params;
    const { newStatus } = req.body;
    const updatedOrder = await orderManageService.updateOrderStatus(orderNumber, newStatus);
    if (!updatedOrder) {
      return res.status(404).json({ message: '未找到订单或更新失败' });
    }
    return res.json({ message: '订单状态更新成功', order: updatedOrder });
  } catch (error) {
    console.error(`更新订单 ${req.params?.orderNumber || ''} 状态失败:`, error);
    return res.status(500).json({ message: '更新订单状态失败', error: error.message });
  }
}

/**
 * 保存订单基础字段。
 * 多日订单会同步同一 order_id 下所有日记录，复杂房价和账单编辑走 with-bills。
 */
async function updateOrder(req, res) {
  const { orderNumber } = req.params;
  try {
    const updatedOrder = await orderManageService.updateOrder(orderNumber, req.body);
    return res.json({ success: true, message: '订单更新成功', data: updatedOrder });
  } catch (error) {
    console.error(`更新订单 ${orderNumber} 失败:`, error);
    return res.status(500).json({ success: false, message: '更新订单失败', error: error.message });
  }
}

/**
 * 给每日房间安排页修改某一天的房间。
 * 多日订单只改指定 stayDate 那一行，跨房型校验和账单同步由 service 处理。
 */
async function updateOrderDayRoom(req, res) {
  const { orderNumber } = req.params;
  const { stayDate, newRoomNumber } = req.body;

  try {
    if (!stayDate || !newRoomNumber) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: stayDate 和 newRoomNumber'
      });
    }

    const updatedRow = await orderManageService.updateOrderDayRoom(orderNumber, stayDate, newRoomNumber, req.user);
    return res.json({
      success: true,
      message: `订单 ${orderNumber} 的 ${stayDate} 房间已更换为 ${newRoomNumber}`,
      data: updatedRow
    });
  } catch (error) {
    console.error(`更新订单 ${orderNumber} 日期 ${stayDate} 房间失败:`, error);
    const status = error.message.includes('不存在')
      || error.message.includes('占用')
      || error.message.includes('不匹配')
      ? 400
      : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
}

/**
 * 给订单编辑页同时保存订单和账单。
 * 支持每日房价和房费/押金支付拆分，金额校验与事务由 service 统一处理。
 */
async function updateOrderWithBills(req, res) {
  const { orderNumber } = req.params;
  try {
    const result = await orderManageService.updateOrderWithBills(orderNumber, req.body || {});
    return res.json(result);
  } catch (error) {
    console.error(`联合更新订单 ${orderNumber} 失败:`, error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 500 ? '联合更新失败' : error.message,
      error: error.message,
      code: error.code || 'UPDATE_WITH_BILLS_ERROR'
    });
  }
}

/**
 * 给提前退房弹窗获取建议退款信息。
 * 这里只做参数透传，是否可退和可退金额由后端业务层统一判断。
 */
async function getEarlyCheckoutRecommendation(req, res) {
  const { orderNumber } = req.params;
  try {
    const result = await orderManageService.getEarlyCheckoutRecommendation(orderNumber, req.query || {});
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(`获取提前退房推荐 ${orderNumber} 失败:`, error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode >= 500 ? '获取提前退房推荐失败' : error.message,
      error: error.message,
      code: error.code || 'EARLY_CHECKOUT_RECOMMENDATION_ERROR'
    });
  }
}

/**
 * 办理提前退房。
 * operator 优先于登录用户；退款、删未住日期和房态更新由 service 统一处理。
 */
async function earlyCheckout(req, res) {
  const { orderNumber } = req.params;
  try {
    const valid = validateEarlyCheckout(req.body);
    if (!valid) {
      console.error('提前退房请求参数验证失败:', validateEarlyCheckout.errors);
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validateEarlyCheckout.errors
      });
    }

    const result = await orderManageService.earlyCheckout(orderNumber, req.body, req.user);

    return res.status(200).json({
      success: true,
      message: '提前退房办理成功',
      data: result
    });
  } catch (error) {
    console.error(`提前退房 ${orderNumber} 失败:`, error);
    const statusCode = error.statusCode || (error.code && error.code.startsWith('EARLY_CHECKOUT') ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      message: statusCode >= 500 ? '提前退房办理失败' : error.message,
      error: error.message,
      code: error.code || 'EARLY_CHECKOUT_ERROR'
    });
  }
}

/**
 * 办理退押金。
 * 只有“退款超过可退金额”按客户端错误返回，其他异常保持旧接口的服务端错误口径。
 */
async function refundDeposit(req, res) {
  try {
    const refundData = req.body;
    const updatedOrder = await orderManageService.refundDeposit(refundData);

    return res.json({
      message: '退押金处理成功',
      order: updatedOrder,
      refundData: {
        change_price: refundData.change_price,
        method: refundData.method,
        refundTime: refundData.refundTime
      }
    });
  } catch (error) {
    console.error('退押金处理失败:', error.message);
    const msg = error.message || '退押金处理失败';
    const isClientError = msg.includes('退押金金额不能超过可退金额');
    const status = isClientError ? 400 : 500;
    return res.status(status).json({
      message: isClientError ? msg : '退押金处理失败',
      error: msg,
      code: error.code || (isClientError ? 'REFUND_VALIDATION' : 'REFUND_SERVER_ERROR'),
      availableRefund: error.availableRefund,
      originalDeposit: error.originalDeposit,
      currentRefundedDeposit: error.currentRefundedDeposit
    });
  }
}

/**
 * 给押金弹窗读取当前可退押金。
 * 押金状态按账单统计，避免只看 orders.deposit 导致多次退押口径不一致。
 */
async function getDepositInfo(req, res) {
  try {
    const { order_id } = req.params;
    const status = await orderManageService.getDepositInfo(order_id);
    return res.json({ success: true, data: status });
  } catch (e) {
    return res.status(500).json({ success: false, message: '获取押金状态失败', error: e.message });
  }
}

/**
 * 办理正常退房。
 * 订单状态、房态和事务由 service 负责，controller 只保持原响应格式。
 */
async function checkOut(req, res) {
  try {
    const { orderId } = req.params;
    const result = await orderManageService.checkOut(orderId);
    console.log('✅ 办理退房成功:', orderId);

    return res.status(200).json({
      success: true,
      data: result,
      message: '办理退房成功'
    });
  } catch (error) {
    console.error('❌ [check-out] 办理退房失败:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 500 ? '办理退房失败' : error.message,
      error: error.message
    });
  }
}

module.exports = {
  checkOut,
  earlyCheckout,
  getDepositInfo,
  getEarlyCheckoutRecommendation,
  getOrder,
  listDailyOrders,
  listOrders,
  refundDeposit,
  updateOrder,
  updateOrderDayRoom,
  updateOrderStatus,
  updateOrderWithBills
};
