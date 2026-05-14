const {
  normalizeOrderListFilters,
  validateEarlyCheckout,
  validateUpdateOrderStatus
} = require('../orderManage.validator');

describe('订单管理列表筛选参数校验', () => {
  test('用户传入搜索、状态和日期筛选时，应当去掉首尾空格后继续查询', () => {
    const result = normalizeOrderListFilters({
      search: ' 张三 ',
      status: ' pending ',
      date: ' 2025-11-30 '
    });

    expect(result.error).toBeUndefined();
    expect(result.filters).toEqual({
      search: '张三',
      status: 'pending',
      date: '2025-11-30'
    });
  });

  test('用户传入不支持的订单状态时，应当拒绝筛选请求', () => {
    const result = normalizeOrderListFilters({ status: 'bad-status' });

    expect(result.filters).toBeUndefined();
    expect(result.error).toEqual({
      message: '订单状态筛选参数不合法',
      code: 'INVALID_STATUS_FILTER'
    });
  });

  test('用户传入的日期不是 YYYY-MM-DD 时，应当拒绝筛选请求', () => {
    const result = normalizeOrderListFilters({ date: '2025/11/30' });

    expect(result.filters).toBeUndefined();
    expect(result.error).toEqual({
      message: '日期筛选格式错误，请使用 YYYY-MM-DD',
      code: 'INVALID_DATE_FILTER'
    });
  });
});

describe('订单状态修改参数校验', () => {
  test('用户传入支持的目标状态时，应当通过参数校验', () => {
    expect(validateUpdateOrderStatus({ newStatus: 'checked-in' })).toBe(true);
  });

  test('用户传入多余字段时，应当拒绝状态修改请求', () => {
    expect(validateUpdateOrderStatus({
      newStatus: 'checked-in',
      reason: '不允许的字段'
    })).toBe(false);
  });
});

describe('提前退房参数校验', () => {
  test('用户填写实际退房时间和退款金额时，应当通过参数校验', () => {
    expect(validateEarlyCheckout({
      actualCheckoutTime: '2026-01-11T09:00',
      refundAmount: '120.00',
      refundMethod: '现金',
      hasStayed: true
    })).toBe(true);
  });

  test('用户没填退款金额时，应当拒绝提前退房请求', () => {
    expect(validateEarlyCheckout({
      actualCheckoutTime: '2026-01-11T09:00'
    })).toBe(false);
  });
});
