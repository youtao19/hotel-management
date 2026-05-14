const roomStatusRepository = require('./roomStatus.repository');

const DISPLAY_STATUSES = ['available', 'occupied', 'reserved', 'cleaning', 'repair'];

function createRoomSummary(roomRows = [], summaryDate = null) {
  const summary = {
    date: summaryDate || null,
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    cleaning: 0,
    repair: 0
  };

  for (const row of roomRows) {
    const status = DISPLAY_STATUSES.includes(row?.display_status) ? row.display_status : 'available';
    summary.total += 1;
    summary[status] += 1;
  }

  return summary;
}

function normalizeRoomKeyword(keyword) {
  return String(keyword || '').trim().toLowerCase();
}

function matchesRoomKeyword(roomRow, normalizedKeyword) {
  if (!normalizedKeyword) return true;
  const haystack = [
    roomRow?.room_number,
    roomRow?.order_id,
    roomRow?.guest_name,
    roomRow?.phone,
    roomRow?.remarks
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedKeyword);
}

async function listRoomStatus(filters = {}) {
  const queryDate = filters.date ? String(filters.date).trim() : null;
  const typeCode = filters.typeCode ? String(filters.typeCode).trim() : null;
  const status = filters.status ? String(filters.status).trim() : null;
  const keyword = normalizeRoomKeyword(filters.keyword);

  const rows = await roomStatusRepository.listRoomStatusRows(queryDate);
  const filteredRows = rows.filter((row) => {
    // 单日房态筛选放在后端，避免前端各页面重复实现不同口径。
    if (typeCode && row.type_code !== typeCode) return false;
    if (status && row.display_status !== status) return false;
    if (!matchesRoomKeyword(row, keyword)) return false;
    return true;
  });
  const summaryDate = filteredRows[0]?.query_date || rows[0]?.query_date || queryDate || null;

  return {
    rows: filteredRows,
    summary: createRoomSummary(filteredRows, summaryDate)
  };
}

async function getRoomStatusRange(roomNumber, startDate, endDate) {
  return roomStatusRepository.listRoomStatusRangeRows(roomNumber, startDate, endDate);
}

async function getCalendarBoard(filters = {}) {
  const startDate = String(filters.startDate || '').trim();
  const days = Number(filters.days || 14);
  const typeCode = filters.typeCode ? String(filters.typeCode).trim() : null;
  const status = filters.status ? String(filters.status).trim() : null;
  const keyword = normalizeRoomKeyword(filters.keyword);

  const rows = await roomStatusRepository.listCalendarBoardRows(startDate, days, typeCode);
  const roomMap = new Map();
  const dateMap = new Map();

  for (const row of rows) {
    if (!roomMap.has(row.room_number)) {
      roomMap.set(row.room_number, {
        room_number: row.room_number,
        type_code: row.type_code,
        type_name: row.type_name,
        room_status: row.room_status,
        is_closed: row.is_closed,
        price: row.price,
        calendar: []
      });
    }

    const roomEntry = roomMap.get(row.room_number);
    roomEntry.calendar.push({
      date: row.stay_date,
      display_status: row.display_status,
      price: row.price,
      order_id: row.order_id,
      order_status: row.order_status,
      guest_name: row.guest_name,
      phone: row.phone,
      remarks: row.remarks,
      check_in_date: row.check_in_date,
      check_out_date: row.check_out_date
    });

    if (!dateMap.has(row.stay_date)) {
      dateMap.set(row.stay_date, {
        date: row.stay_date,
        total: 0,
        available: 0,
        occupied: 0,
        reserved: 0,
        cleaning: 0,
        repair: 0,
        available_count: 0
      });
    }
  }

  const filteredRooms = Array.from(roomMap.values())
    .filter((room) => {
      const statusMatched = !status || room.calendar.some(cell => cell.display_status === status);
      if (!statusMatched) return false;

      if (!keyword) return true;
      return room.calendar.some(cell => matchesRoomKeyword({
        room_number: room.room_number,
        order_id: cell.order_id,
        guest_name: cell.guest_name,
        phone: cell.phone,
        remarks: cell.remarks
      }, keyword));
    })
    .sort((left, right) => {
      const groupCompare = String(left.type_name || left.type_code || '').localeCompare(
        String(right.type_name || right.type_code || ''),
        'zh-Hans-CN'
      );
      if (groupCompare !== 0) return groupCompare;
      return String(left.room_number).localeCompare(String(right.room_number), 'zh-Hans-CN');
    });

  const filteredRows = [];
  for (const room of filteredRooms) {
    for (const cell of room.calendar) {
      filteredRows.push({
        room_number: room.room_number,
        display_status: cell.display_status,
        stay_date: cell.date
      });
      const dateEntry = dateMap.get(cell.date);
      if (!dateEntry) continue;
      dateEntry.total += 1;
      dateEntry[cell.display_status] += 1;
      if (cell.display_status === 'available') {
        dateEntry.available_count += 1;
      }
    }
  }

  const dailySummary = Array.from(dateMap.values())
    .filter(item => item.total > 0)
    .sort((left, right) => String(left.date).localeCompare(String(right.date), 'zh-Hans-CN'));
  const summaryRows = filteredRows.filter(row => row.stay_date === startDate);

  return {
    query: {
      startDate,
      days,
      typeCode,
      status,
      keyword: String(filters.keyword || '').trim()
    },
    summary: createRoomSummary(summaryRows, startDate),
    dailySummary,
    rooms: filteredRooms
  };
}

async function updateRoomStatus(number, status) {
  // 维修房需要同步关闭，其他状态恢复开放；这个口径会影响可用房查询和渠道库存。
  const isClosed = status === 'repair';
  return roomStatusRepository.updateRoomStatus(number, status, isClosed);
}

module.exports = {
  createRoomSummary,
  getCalendarBoard,
  getRoomStatusRange,
  listRoomStatus,
  matchesRoomKeyword,
  normalizeRoomKeyword,
  updateRoomStatus
};
