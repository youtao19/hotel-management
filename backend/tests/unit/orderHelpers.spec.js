// 订单相关纯函数/校验逻辑单元测试
const orderModule = require('../../modules/orderModule');

describe('orderModule 单元函数测试', () => {
  describe('isRestRoom', () => {
    test('同日入住退房 => 休息房', () => {
      const r = orderModule.isRestRoom({ check_in_date: '2025-01-01', check_out_date: '2025-01-01' });
      expect(r).toBe(true);
    });
    test('跨日入住退房 => 非休息房', () => {
      const r = orderModule.isRestRoom({ check_in_date: '2025-01-01', check_out_date: '2025-01-02' });
      expect(r).toBe(false);
    });
  });

  describe('calculateTotalPrice', () => {
    test('数字直接返回', () => {
      expect(orderModule.calculateTotalPrice(123)).toBe(123);
    });
    test('JSON 对象累加', () => {
      const total = orderModule.calculateTotalPrice({ '2025-01-01': 100, '2025-01-02': 150 });
      expect(total).toBe(250);
    });
    test('非法输入返回 0', () => {
      expect(orderModule.calculateTotalPrice(null)).toBe(0);
    });
  });

  describe('validatePriceDateRange', () => {
    test('单晚住宿: 只有入住日期价格', () => {
      const r = orderModule.validatePriceDateRange({ '2025-01-01': 200 }, '2025-01-01', '2025-01-02');
      expect(r.isValid).toBe(true);
    });
    test('多晚住宿: 结束日为退房前一日', () => {
      const r = orderModule.validatePriceDateRange({ '2025-01-01': 100, '2025-01-02': 120 }, '2025-01-01', '2025-01-03');
      expect(r.isValid).toBe(true);
    });
    test('日期不连续应失败', () => {
      const r = orderModule.validatePriceDateRange({ '2025-01-01': 100, '2025-01-03': 120 }, '2025-01-01', '2025-01-04');
      expect(r.isValid).toBe(false);
    });
  });
});
