const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { toAmountNumber } = require('../tools');
const orderCreateService = require('./orderCreate.service');
const {
  createOrderSchema,
  normalizeOptionalSplitField,
  pricingBreakdownSchema
} = require('./orderCreate.validator');

const ajv = new Ajv();
addFormats(ajv);

async function getPricingBreakdown(req, res) {
  try {
    const validate = ajv.compile(pricingBreakdownSchema);
    const valid = validate(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validate.errors
      });
    }

    const result = await orderCreateService.getPricingBreakdown(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('定价拆分失败:', err);
    const code = err.code || 'UNKNOWN';
    const status = ['INVALID_DATE_RANGE', 'INVALID_PRICE', 'INVALID_MODE'].includes(code) ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || '定价拆分失败',
      error: { code, details: err.message }
    });
  }
}

async function createOrder(req, res) {
  try {
    console.log('收到订单创建请求，请求体:', JSON.stringify(req.body, null, 2));

    const validate = ajv.compile(createOrderSchema);
    const valid = validate(req.body);
    if (!valid) {
      console.error('订单创建请求参数验证失败:', validate.errors);
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validate.errors
      });
    }
    const newOrder = await orderCreateService.createOrder(req.body);

    res.status(201).json({
      success: true,
      message: '订单创建成功',
      data: {
        order: newOrder
      }
    });
  } catch (error) {
    console.error('创建订单失败(路由层):', error.code || 'NO_CODE', error.message);

    switch (error.code) {
      case 'DUPLICATE_ORDER':
        return res.status(409).json({
          success: false,
          message: '相同订单已存在',
          data: {
            existingOrder: error.existingOrder
          }
        });

      case 'MISSING_REQUIRED_FIELDS':
      case 'INVALID_ORDER_STATUS':
      case 'INVALID_DATE_FORMAT':
      case 'INVALID_DATE_RANGE':
      case 'INVALID_PHONE_FORMAT':
      case 'INVALID_PRICE':
      case 'INVALID_PRICE_EMPTY':
      case 'INVALID_PRICE_JSON':
      case 'INVALID_PRICE_DATE_FORMAT':
      case 'INVALID_PRICE_DATE_RANGE':
      case 'INVALID_DEPOSIT':
      case 'INVALID_STAY_TYPE':
      case 'INVALID_ROOM_TYPE':
      case 'INVALID_ROOM_NUMBER':
      case 'ROOM_CLOSED':
      case 'ROOM_ALREADY_BOOKED':
        return res.status(400).json({
          success: false,
          message: error.message,
          error: {
            code: error.code,
            details: error.message
          }
        });

      case '23505':
        return res.status(409).json({
          success: false,
          message: '订单创建失败：数据重复',
          error: error.message
        });

      case '23503':
        return res.status(400).json({
          success: false,
          message: '订单创建失败：无效的关联数据',
          error: error.message
        });

      default:
        return res.status(500).json({
          success: false,
          message: '订单创建失败',
          error: { code: error.code || 'UNKNOWN', details: error.message }
        });
    }
  }
}

async function checkIn(req, res) {
  try {
    const { orderId } = req.params;
    const { deposit, roomFeePaymentSplits, depositPaymentSplits, depositPaymentMethod } = req.body || {};

    await orderCreateService.checkIn(orderId, deposit, {
      roomFeePaymentSplits,
      depositPaymentSplits,
      depositPaymentMethod
    });

    return res.status(200).json({
      success: true,
      message: '办理入住成功'
    });
  } catch (error) {
    console.error('❌ [check-in] 办理入住失败:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 500 ? '办理入住失败' : error.message,
      error: error.message
    });
  }
}

async function fastCheckIn(req, res) {
  try {
    const body = req.body || {};
    const normalizedRoomFeeSplits = normalizeOptionalSplitField(
      body.roomFeePaymentSplits ?? body.room_fee_payment_splits
    );
    const normalizedDepositSplits = normalizeOptionalSplitField(
      body.depositPaymentSplits ?? body.deposit_payment_splits
    );
    const orderData = {
      orderId: body.orderId || body.order_id,
      sourceNumber: body.sourceNumber || body.idSource || body.id_source || '',
      orderSource: body.orderSource || body.order_source,
      guestName: body.guestName || body.guest_name,
      phone: body.phone,
      roomType: body.room_types || body.roomType || body.room_type,
      roomNumber: body.roomNumber || body.room_number,
      checkInDate: body.checkInDate || body.check_in_date,
      checkOutDate: body.checkOutDate || body.check_out_date,
      status: body.status || 'checked-in',
      paymentMethod: body.paymentMethod || body.payment_method,
      roomPrice: body.roomPrice || body.total_price,
      deposit: body.deposit,
      isPrepaid: body.isPrepaid,
      prepaidAmount: body.prepaidAmount || body.prepaid_amount,
      roomFeePaymentSplits: normalizedRoomFeeSplits,
      depositPaymentSplits: normalizedDepositSplits,
      depositPaymentMethod: body.depositPaymentMethod || body.deposit_payment_method,
      stayType: body.stayType || body.stay_type,
      createTime: body.createTime || body.create_time,
      remarks: body.remarks
    };

    const validate = ajv.compile(createOrderSchema);
    const valid = validate(orderData);
    if (!valid) {
      console.error('快速入住请求参数验证失败:', validate.errors);
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validate.errors
      });
    }

    const depositAmount = toAmountNumber(orderData.deposit || 0);

    console.log('🚀 收到快速入住请求:', {
      order_id: orderData.orderId,
      guest_name: orderData.guestName,
      room_number: orderData.roomNumber,
      deposit: depositAmount
    });

    const result = await orderCreateService.fastCheckIn(orderData, req.user?.name || 'system');

    console.log('✅ 快速入住成功:', result.order.order_id);

    return res.status(200).json({
      success: true,
      message: '快速入住成功',
      data: result
    });
  } catch (error) {
    console.error('❌ 快速入住失败:', error);
    // 重要：如果业务层已标注 statusCode/code，这里需要透传，
    // 否则前端只会看到“500”，无法判断是参数问题还是事务问题。
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 500 ? '快速入住失败' : (error.message || '快速入住失败'),
      error: {
        code: error.code || 'UNKNOWN',
        message: error.message
      }
    });
  }
}

module.exports = {
  checkIn,
  createOrder,
  fastCheckIn,
  getPricingBreakdown
};
