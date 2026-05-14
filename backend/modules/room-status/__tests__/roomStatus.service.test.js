jest.mock('../roomStatus.repository', () => ({
  listCalendarBoardRows: jest.fn(),
  listRoomStatusRangeRows: jest.fn(),
  listRoomStatusRows: jest.fn(),
  updateRoomStatus: jest.fn()
}));

const roomStatusRepository = require('../roomStatus.repository');
const roomStatusService = require('../roomStatus.service');

describe('房间状态业务规则', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('查询单日房态时，应当按展示状态和关键词筛选并生成汇总', async () => {
    roomStatusRepository.listRoomStatusRows.mockResolvedValue([
      {
        query_date: '2025-12-10',
        room_number: '101',
        type_code: 'A',
        display_status: 'reserved',
        guest_name: '张三'
      },
      {
        query_date: '2025-12-10',
        room_number: '102',
        type_code: 'A',
        display_status: 'available',
        guest_name: null
      }
    ]);

    const result = await roomStatusService.listRoomStatus({
      date: '2025-12-10',
      typeCode: 'A',
      status: 'reserved',
      keyword: '张'
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].room_number).toBe('101');
    expect(result.summary).toEqual({
      date: '2025-12-10',
      total: 1,
      available: 0,
      occupied: 0,
      reserved: 1,
      cleaning: 0,
      repair: 0
    });
  });

  test('查询日历房态时，状态命中任一天就保留整间房', async () => {
    roomStatusRepository.listCalendarBoardRows.mockResolvedValue([
      {
        stay_date: '2025-12-10',
        room_number: '101',
        type_code: 'A',
        type_name: 'A房型',
        price: 200,
        room_status: 'available',
        is_closed: false,
        display_status: 'available'
      },
      {
        stay_date: '2025-12-11',
        room_number: '101',
        type_code: 'A',
        type_name: 'A房型',
        price: 200,
        room_status: 'available',
        is_closed: false,
        display_status: 'reserved',
        order_id: 'ORDER_001'
      }
    ]);

    const result = await roomStatusService.getCalendarBoard({
      startDate: '2025-12-10',
      days: 14,
      status: 'reserved'
    });

    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].calendar).toHaveLength(2);
    expect(result.summary.reserved).toBe(0);
    expect(result.dailySummary[1].reserved).toBe(1);
  });

  test('手动设为维修时，应当同步关闭房间', async () => {
    roomStatusRepository.updateRoomStatus.mockResolvedValue({ room_number: '101', status: 'repair', is_closed: true });

    await roomStatusService.updateRoomStatus('101', 'repair');

    expect(roomStatusRepository.updateRoomStatus).toHaveBeenCalledWith('101', 'repair', true);
  });

  test('手动设为非维修状态时，应当恢复房间开放', async () => {
    roomStatusRepository.updateRoomStatus.mockResolvedValue({ room_number: '101', status: 'cleaning', is_closed: false });

    await roomStatusService.updateRoomStatus('101', 'cleaning');

    expect(roomStatusRepository.updateRoomStatus).toHaveBeenCalledWith('101', 'cleaning', false);
  });
});
