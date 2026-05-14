jest.mock('../roomStatus.service', () => ({
  getCalendarBoard: jest.fn(),
  getRoomStatusRange: jest.fn(),
  listRoomStatus: jest.fn(),
  updateRoomStatus: jest.fn()
}));

const roomStatusService = require('../roomStatus.service');
const controller = require('../roomStatus.controller');

function createReq({ params = {}, query = {}, body = {} } = {}) {
  return { params, query, body };
}

function createRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('房间状态 HTTP 调用', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('查询单日房态时，应当把归一化后的筛选条件传给 service', async () => {
    const req = createReq({
      query: { date: '2025-12-10', typeCode: ' TEST_TYPE ', status: 'reserved', keyword: ' 张三 ' }
    });
    const res = createRes();
    roomStatusService.listRoomStatus.mockResolvedValue({
      rows: [{ room_number: '101' }],
      summary: { date: '2025-12-10', total: 1 }
    });

    await controller.listRoomStatus(req, res);

    expect(roomStatusService.listRoomStatus).toHaveBeenCalledWith({
      date: '2025-12-10',
      typeCode: 'TEST_TYPE',
      status: 'reserved',
      keyword: '张三'
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ room_number: '101' }],
      summary: { date: '2025-12-10', total: 1 },
      query: {
        date: '2025-12-10',
        typeCode: 'TEST_TYPE',
        status: 'reserved',
        keyword: '张三'
      },
      message: '查询到 2025-12-10 的房间状态'
    });
  });

  test('查询区间房态时，应当保留原来的 404 空数据口径', async () => {
    const req = createReq({
      query: { roomNumber: '101', startDate: '2025-12-10', endDate: '2025-12-12' }
    });
    const res = createRes();
    roomStatusService.getRoomStatusRange.mockResolvedValue([]);

    await controller.getRoomStatusRange(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: '未找到房间或无数据' });
  });

  test('查询日历房态时，应当把 14 天窗口筛选条件传给 service', async () => {
    const req = createReq({
      query: { startDate: '2025-12-10', days: '14', status: 'available' }
    });
    const res = createRes();
    roomStatusService.getCalendarBoard.mockResolvedValue({ rooms: [] });

    await controller.getCalendarBoard(req, res);

    expect(roomStatusService.getCalendarBoard).toHaveBeenCalledWith({
      startDate: '2025-12-10',
      days: 14,
      typeCode: null,
      status: 'available',
      keyword: null
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ rooms: [] });
  });

  test('手动改房态时，应当保持原来的非法状态响应格式', async () => {
    const req = createReq({
      params: { number: '101' },
      body: { status: 'invalid-status' }
    });
    const res = createRes();

    await controller.updateRoomStatus(req, res);

    expect(roomStatusService.updateRoomStatus).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: '无效的房间状态',
      requestedStatus: 'invalid-status',
      validStatuses: ['available', 'occupied', 'cleaning', 'repair', 'reserved']
    });
  });

  test('手动改房态时，应当把房号和状态传给 service', async () => {
    const req = createReq({
      params: { number: '101' },
      body: { status: 'cleaning' }
    });
    const res = createRes();
    roomStatusService.updateRoomStatus.mockResolvedValue({ room_number: '101', status: 'cleaning' });

    await controller.updateRoomStatus(req, res);

    expect(roomStatusService.updateRoomStatus).toHaveBeenCalledWith('101', 'cleaning');
    expect(res.json).toHaveBeenCalledWith({ data: { room_number: '101', status: 'cleaning' } });
  });
});
