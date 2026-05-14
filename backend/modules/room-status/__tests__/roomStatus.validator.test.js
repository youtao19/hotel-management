const {
  normalizeCalendarBoardQuery,
  normalizeRoomStatusQuery,
  normalizeStatusRangeQuery,
  validateUpdateRoomStatus
} = require('../roomStatus.validator');

describe('房间状态参数校验', () => {
  test('查询单日房态时，应当去掉筛选条件前后的空格', () => {
    const result = normalizeRoomStatusQuery({
      date: '2025-12-10',
      typeCode: ' TEST_TYPE ',
      status: ' reserved ',
      keyword: ' 张三 '
    });

    expect(result.error).toBeUndefined();
    expect(result.filters).toEqual({
      date: '2025-12-10',
      typeCode: 'TEST_TYPE',
      status: 'reserved',
      keyword: '张三'
    });
  });

  test('查询单日房态时，日期格式不是 YYYY-MM-DD 应当拒绝', () => {
    const result = normalizeRoomStatusQuery({ date: '2025/12/10' });

    expect(result.error.message).toBe('日期格式必须为 YYYY-MM-DD');
  });

  test('查询区间房态时，结束日期早于开始日期应当拒绝', () => {
    const result = normalizeStatusRangeQuery({
      roomNumber: '101',
      startDate: '2025-12-12',
      endDate: '2025-12-10'
    });

    expect(result.error.message).toBe('endDate 不能早于 startDate');
  });

  test('查询日历房态时，只接受 14 天窗口', () => {
    const result = normalizeCalendarBoardQuery({
      startDate: '2025-12-10',
      days: '7'
    });

    expect(result.error.message).toBe('days 当前仅支持 14');
  });

  test('手动改房态时，只接受系统支持的状态', () => {
    const valid = validateUpdateRoomStatus({ status: 'invalid-status' });

    expect(valid).toBe(false);
    expect(validateUpdateRoomStatus.errors[0].instancePath).toBe('/status');
  });
});
