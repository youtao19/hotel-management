const express = require('express');
const router = express.Router();
// 保险：为该路由挂载 JSON 解析（即使全局已启用）
router.use(express.json());
const { body, param, validationResult } = require('express-validator');
const orderChangeModule = require('../modules/orderChangeModule');
const orderModule = require('../modules/orderModule');
const { authenticationMiddleware } = require('../modules/authentication');

/**
 * 修改订单
 * PUT /api/order-changes/:orderId
 */
router.put('/:orderId', [
  param('orderId')
    .notEmpty().withMessage('订单ID不能为空'),
  body('updateData')
    .isObject().withMessage('更新数据必须是对象'),
  body('reason')
    .optional()
    .isString().withMessage('修改原因必须是字符串'),
  body('operator')
    .optional()
    .isString().withMessage('操作人必须是字符串')
], async (req, res) => {
  try {
    // 验证请求数据
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '请求数据验证失败',
        errors: errors.array()
      });
    }

    const { orderId } = req.params;
    const { updateData, reason, operator } = req.body;

    console.log(`处理订单 ${orderId} 的修改请求，修改内容:`, JSON.stringify(updateData));

    // 调用订单修改模块
    const updatedOrder = await orderChangeModule.updateOrder(
      orderId,
      updateData,
      reason,
      operator
    );

    res.json({
      success: true,
      message: '订单修改成功',
      data: {
        order: updatedOrder
      }
    });

  } catch (error) {
    console.error('修改订单失败:', error);

    // 根据错误类型返回不同的状态码和消息
    if (error.code === 'ORDER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: '订单不存在',
        error: error.message
      });
    }

    // 数据库约束冲突错误
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: '订单修改失败: 数据冲突',
        error: error.message
      });
    }

    // 数据库外键约束错误
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: '订单修改失败: 无效的关联数据',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: '订单修改失败',
      error: error.message
    });
  }
});

/**
 * 获取订单修改历史
 * GET /api/order-changes/:orderId/history
 */
router.get('/:orderId/history', [
  param('orderId')
    .notEmpty().withMessage('订单ID不能为空')
], async (req, res) => {
  try {
    const { orderId } = req.params;

    // 获取订单修改历史
    const history = await orderChangeModule.getOrderChangeHistory(orderId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('获取订单修改历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单修改历史失败',
      error: error.message
    });
  }
});

/**
 * 获取特定时间范围内的所有订单修改历史
 * GET /api/order-changes
 */
router.get('/', [
  body('startDate')
    .optional()
    .isISO8601().withMessage('开始日期格式无效'),
  body('endDate')
    .optional()
    .isISO8601().withMessage('结束日期格式无效')
], async (req, res) => {
  try {
    // 验证请求数据
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '请求数据验证失败',
        errors: errors.array()
      });
    }

    // 默认查询最近7天
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // 如果有提供日期范围，则使用提供的日期
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate);
      // 确保结束日期包含当天的所有时间
      endDate.setHours(23, 59, 59, 999);
    }

    // 获取时间范围内的所有订单修改历史
    const history = await orderChangeModule.getAllOrderChangesInRange(startDate, endDate);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('获取订单修改历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取订单修改历史失败',
      error: error.message
    });
  }
});

module.exports = router;
