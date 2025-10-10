/**
 * 订单辅助函数单元测试文件
 *
 * 测试模块：orderModule 纯函数
 *
 * ✅ 核心功能说明：
 * 1. 订单类型判断（客房/休息房）
 * 2. 价格计算和验证
 * 3. 日期范围验证
 * 4. 业务规则校验逻辑
 *
 * ✅ 测试覆盖范围：
 * - ✅ isRestRoom - 休息房判定逻辑
 * - ✅ calculateTotalPrice - 价格计算函数
 * - ✅ validatePriceDateRange - 价格日期范围验证
 *
 * 💡 业务规则说明：
 * 1. 休息房定义：入住日期和退房日期相同
 * 2. 客房定义：入住日期和退房日期不同（跨日）
 * 3. 价格数据格式：
 *    - 简单数字：直接使用
 *    - JSON对象：{ "日期": 价格 } 需要累加
 * 4. 价格日期范围规则：
 *    - 单晚：只包含入住日期
 *    - 多晚：包含入住日到退房前一日
 *    - 日期必须连续
 *
 * 🧪 测试策略：
 * - 使用纯函数测试，不依赖数据库
 * - 覆盖正常情况和边界情况
 * - 测试输入验证和错误处理
 *
 * 作者：AI Assistant
 * 日期：2025-10-10
 */

const orderModule = require('../../modules/orderModule');

describe('orderModule - 订单辅助函数单元测试', () => {
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
