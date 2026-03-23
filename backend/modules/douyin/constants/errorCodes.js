/**
 * 抖音通用成功结果定义。
 */
const DOUYIN_SUCCESS_RESULT = Object.freeze({
  code: 0,
  description: 'success',
})

/**
 * 抖音通用兜底错误定义。
 */
const DOUYIN_COMMON_ERROR = Object.freeze({
  OTHER_EXCEPTION: {
    code: 13,
    description: '其他异常',
  },
  RETRY_LATER: {
    code: 100,
    description: '需要重试',
  },
})

/**
 * 抖音创单场景错误定义。
 */
const DOUYIN_BOOKING_ERROR = Object.freeze({
  ROOM_TYPE_INVALID: {
    code: 1,
    description: '房型不存在/失效',
  },
  ROOM_FULL: {
    code: 4,
    description: '入住时期内已满',
  },
  INVALID_DATE: {
    code: 5,
    description: '日期格式错误',
  },
  INVALID_CONTACT: {
    code: 6,
    description: '姓名/联系电话格式错',
  },
  MISSING_ORDER_ID: {
    code: 13,
    description: '缺少抖音订单号',
  },
  MISSING_HOTEL_ID: {
    code: 13,
    description: '缺少抖音酒店ID',
  },
  MISSING_BIZ_TYPE: {
    code: 13,
    description: '缺少业务类型',
  },
  INVALID_ROOM_COUNT: {
    code: 13,
    description: '预定间数不合法',
  },
  INVALID_GUEST_COUNT: {
    code: 13,
    description: '入住人数不合法',
  },
  INVALID_AMOUNT: {
    code: 13,
    description: '订单金额不合法',
  },
})

/**
 * 抖音取消场景错误定义。
 */
const DOUYIN_CANCEL_ERROR = Object.freeze({
  ORDER_NOT_FOUND: {
    code: 9,
    description: '订单不存在或状态异常',
  },
  MISSING_ORDER_ID: {
    code: 13,
    description: '缺少抖音订单号',
  },
  MISSING_CANCEL_ID: {
    code: 13,
    description: '缺少取消单号',
  },
  INVALID_CANCEL_TYPE: {
    code: 13,
    description: '取消类型不合法',
  },
  INVALID_BIZ_TYPE: {
    code: 13,
    description: '业务类型不合法',
  },
  INVALID_AFTER_SALE_TYPE: {
    code: 13,
    description: '售后方式不合法',
  },
  INVALID_REFUND_TYPE: {
    code: 13,
    description: '退款类型不合法',
  },
})

module.exports = {
  DOUYIN_SUCCESS_RESULT,
  DOUYIN_COMMON_ERROR,
  DOUYIN_BOOKING_ERROR,
  DOUYIN_CANCEL_ERROR,
}
