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

/**
 * 抖音预售券创单场景错误定义。
 */
const DOUYIN_PRESALE_ERROR = Object.freeze({
  INVALID_BIZ_TYPE: {
    code: 13,
    description: '预售业务类型不合法',
  },
  MISSING_PRE_SALE_COUPON_ID: {
    code: 13,
    description: '缺少预售券ID',
  },
  INVALID_VOUCHER_COUNT: {
    code: 13,
    description: '预售券数量不合法',
  },
})

/**
 * 抖音可订检查场景错误定义。
 */
const DOUYIN_BOOKABLE_ERROR = Object.freeze({
  INVALID_BIZ_TYPE: {
    code: 13,
    description: '可订检查业务类型不合法',
  },
  PRICE_MISMATCH: {
    code: 8,
    description: '价格与酒店实际价格不一致',
  },
  ROOM_STATUS_CLOSED: {
    code: 18,
    description: '日历房态关闭',
  },
})

/**
 * 抖音主动拉取价量态场景错误定义。
 */
const DOUYIN_ARI_PULL_ERROR = Object.freeze({
  INVALID_BIZ_TYPE: {
    code: 13,
    description: '拉取价量态业务类型不合法',
  },
  MISSING_RATE_PLAN_ID: {
    code: 13,
    description: '缺少售卖房型ID',
  },
  MISSING_DATE_RANGE: {
    code: 13,
    description: '缺少拉取日期范围',
  },
})

/**
 * 抖音物理房型场景错误定义。
 */
const DOUYIN_PHYSICAL_ROOM_ERROR = Object.freeze({
  MISSING_ACCOUNT_ID: {
    code: 13,
    description: '缺少抖音商家账号ID',
  },
  MISSING_ROOM_ID: {
    code: 13,
    description: '缺少抖音物理房型ID',
  },
  MISSING_POI_ID: {
    code: 13,
    description: '缺少抖音酒店ID',
  },
  PHYSICAL_ROOM_NOT_FOUND: {
    code: 13,
    description: '抖音物理房型不存在',
  },
  LOCAL_ROOM_TYPE_NOT_FOUND: {
    code: 13,
    description: '本地房型不存在',
  },
  NO_LOCAL_ROOMS: {
    code: 13,
    description: '本地房型下没有可创建的物理房间',
  },
  DUPLICATE_MAPPING: {
    code: 13,
    description: '本地房型已存在抖音物理房型映射',
  },
  INVALID_ACTIVE: {
    code: 13,
    description: '物理房型上下架状态不合法',
  },
})

/**
 * 抖音售卖房型场景错误定义。
 */
const DOUYIN_RATE_PLAN_ERROR = Object.freeze({
  MISSING_ACCOUNT_ID: {
    code: 13,
    description: '缺少抖音商家账号ID',
  },
  MISSING_POI_ID: {
    code: 13,
    description: '缺少抖音酒店ID',
  },
  MISSING_ROOM_ID: {
    code: 13,
    description: '缺少抖音物理房型ID',
  },
  LOCAL_ROOM_TYPE_NOT_FOUND: {
    code: 13,
    description: '本地房型不存在',
  },
  PHYSICAL_ROOM_NOT_FOUND: {
    code: 13,
    description: '抖音物理房型不存在',
  },
  RATE_PLAN_NOT_FOUND: {
    code: 13,
    description: '抖音售卖房型不存在',
  },
  DUPLICATE_RATE_PLAN: {
    code: 13,
    description: '本地房型已存在抖音售卖房型映射',
  },
  INVALID_ACTIVE: {
    code: 13,
    description: '商品上下架状态不合法',
  },
  RATE_PLAN_ID_MISSING: {
    code: 13,
    description: '抖音返回的售卖房型ID缺失',
  },
})

module.exports = {
  DOUYIN_SUCCESS_RESULT,
  DOUYIN_COMMON_ERROR,
  DOUYIN_BOOKING_ERROR,
  DOUYIN_CANCEL_ERROR,
  DOUYIN_PRESALE_ERROR,
  DOUYIN_BOOKABLE_ERROR,
  DOUYIN_ARI_PULL_ERROR,
  DOUYIN_PHYSICAL_ROOM_ERROR,
  DOUYIN_RATE_PLAN_ERROR,
}
