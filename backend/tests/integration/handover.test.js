const path = require('path');
const fs = require('fs');
const request = require('supertest');
const Decimal = require('decimal.js');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');

// Helpers mirroring the CheckData.vue data preparation flow
const PAY_WAY_KEYS = ['现金', '微信', '微邮付', '其他'];
const INCOME_CHANGE_TYPES = ['房费', '收押', '押金', '补收', '订单账单'];
const REFUND_CHANGE_TYPES = ['退押', '退押金', '退款'];

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
});

const toDecimal = (value) => {
  if (Decimal.isDecimal(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return new Decimal(0);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return new Decimal(0);
    }
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? new Decimal(0) : new Decimal(parsed);
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? new Decimal(0) : new Decimal(value);
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? new Decimal(0) : new Decimal(parsed);
};

const toAmountNumber = (value, places = 2) =>
  Number(toDecimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toString());

const normalizePayWay = (payWay) => (PAY_WAY_KEYS.includes(payWay) ? payWay : '其他');

const createPaywayBucket = (seed = {}) => {
  return PAY_WAY_KEYS.reduce((bucket, key) => {
    const source = Object.prototype.hasOwnProperty.call(seed, key) ? seed[key] : 0;
    return {
      ...bucket,
      [key]: toAmountNumber(source)
    };
  }, {});
};

const createSummaryBuckets = () => ({
  hotelIncome: createPaywayBucket(),
  restIncome: createPaywayBucket(),
  hotelRefundDeposit: createPaywayBucket(),
  restRefundDeposit: createPaywayBucket()
});

const incrementBucket = (bucket, payWay, amount, { absolute = false } = {}) => {
  if (!bucket) {
    return;
  }
  const key = normalizePayWay(payWay);
  const delta = absolute ? toDecimal(amount).abs() : toDecimal(amount);
  const updated = toDecimal(bucket[key]).plus(delta);
  bucket[key] = toAmountNumber(updated);
};

const mapBillToRow = (bill = {}, overrides = {}) => {
  const normalizedAmount = overrides.amount !== undefined
    ? overrides.amount
    : (parseFloat(bill.change_price) || 0);
  const changeType = overrides.changeType || bill.change_type;
  const signedAmount = REFUND_CHANGE_TYPES.includes(changeType)
    ? -Math.abs(normalizedAmount)
    : normalizedAmount;
  const normalizedPayWay = overrides.payWay !== undefined
    ? overrides.payWay
    : (bill.pay_way || '其他');

  const row = {
    billId: overrides.billId !== undefined ? overrides.billId : bill.bill_id,
    orderNo: bill.order_id,
    roomNo: bill.room_number || '未知',
    guestName: bill.guest_name || '未知',
    changeType,
    amount: toAmountNumber(signedAmount),
    payWay: normalizedPayWay,
    stayDate: bill.stay_date,
    createTime: overrides.createTime || bill.create_time,
    confirmed: false,
    isAggregatedRoomFee: Boolean(overrides.isAggregatedRoomFee)
  };

  if (overrides.aggregatedBillIds) {
    row.aggregatedBillIds = overrides.aggregatedBillIds;
  }
  if (overrides.aggregatedBills) {
    row.aggregatedBills = overrides.aggregatedBills.map(item => ({
      ...item,
      change_price: toAmountNumber(item.change_price)
    }));
  }

  return row;
};

const extractDatePart = (value = '') => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  if (value.includes('T')) {
    return value.split('T')[0];
  }
  if (value.includes(' ')) {
    return value.split(' ')[0];
  }
  return value.slice(0, 10);
};

const matchesTargetDate = (bill, targetDate) => {
  const createDate = extractDatePart(bill.create_time);
  if (createDate) {
    return createDate === targetDate;
  }
  return extractDatePart(bill.stay_date) === targetDate;
};

const buildTableRows = (bills = [], targetDate) => {
  if (!Array.isArray(bills)) {
    return [];
  }

  const filteredBills = bills.filter(bill => matchesTargetDate(bill, targetDate));
  const rows = [];
  const aggregateGroups = new Map();

  filteredBills.forEach(bill => {
    const rawAmount = parseFloat(bill.change_price) || 0;
    const normalizedAmount = REFUND_CHANGE_TYPES.includes(bill.change_type)
      ? -Math.abs(rawAmount)
      : rawAmount;

    if (bill.change_type === '房费') {
      const aggregateKey = `${bill.order_id || bill.bill_id}-${targetDate}`;

      if (!aggregateGroups.has(aggregateKey)) {
        aggregateGroups.set(aggregateKey, {
          firstBill: bill,
          totalAmount: new Decimal(0),
          billIds: [],
          payWays: new Set(),
          bills: []
        });

        rows.push({ __aggregateKey: aggregateKey });
      }

      const group = aggregateGroups.get(aggregateKey);
      const normalizedDecimal = toDecimal(normalizedAmount);
      group.totalAmount = group.totalAmount.plus(normalizedDecimal);
      group.billIds.push(bill.bill_id);
      group.bills.push({
        ...bill,
        change_price: toAmountNumber(normalizedDecimal)
      });
      if (bill.pay_way) {
        group.payWays.add(bill.pay_way);
      }
    } else {
      rows.push(mapBillToRow(bill));
    }
  });

  return rows.map(row => {
    if (!row.__aggregateKey) {
      row.isAggregatedRoomFee = false;
      return row;
    }

    const group = aggregateGroups.get(row.__aggregateKey);
    if (!group) {
      return row;
    }

    const { firstBill, totalAmount, billIds, payWays } = group;
    const isAggregated = billIds.length > 1;
    const payWayCount = payWays.size;
    let payWayLabel = '其他';

    if (payWayCount === 1) {
      [payWayLabel] = Array.from(payWays);
    } else if (payWayCount > 1) {
      payWayLabel = '多渠道';
    }

    return mapBillToRow(firstBill, {
      billId: isAggregated ? `ROOMFEE-${firstBill.order_id || firstBill.bill_id}-${targetDate}` : billIds[0],
      amount: toAmountNumber(totalAmount),
      payWay: payWayLabel,
      createTime: targetDate,
      isAggregatedRoomFee: isAggregated,
      aggregatedBillIds: billIds,
      aggregatedBills: group.bills
    });
  });
};

const summarizeRoomData = (rows = []) => {
  const totalDecimal = rows.reduce(
    (sum, item) => sum.plus(toDecimal(item.amount || 0)),
    new Decimal(0)
  );
  const byTypeDecimal = {};

  rows.forEach(bill => {
    const type = bill.changeType || '未知';
    const amountDecimal = toDecimal(bill.amount || 0);
    if (!byTypeDecimal[type]) {
      byTypeDecimal[type] = amountDecimal;
    } else {
      byTypeDecimal[type] = byTypeDecimal[type].plus(amountDecimal);
    }
  });

  const byType = {};
  Object.keys(byTypeDecimal).forEach(key => {
    byType[key] = toAmountNumber(byTypeDecimal[key]);
  });

  return {
    totalAmount: toAmountNumber(totalDecimal),
    byType
  };
};

// 汇总数据计算
const calculateSummaryData = (hotelRows = [], restRows = []) => {
  const summaryData = createSummaryBuckets();

  hotelRows.forEach(bill => {
    const payWay = bill.payWay || '其他';
    const normalizedPayWay = normalizePayWay(payWay);
    const amount = bill.amount || 0;
    const changeType = bill.changeType;

    if (INCOME_CHANGE_TYPES.includes(changeType)) {
      incrementBucket(summaryData.hotelIncome, normalizedPayWay, amount);
    } else if (REFUND_CHANGE_TYPES.includes(changeType)) {
      incrementBucket(summaryData.hotelRefundDeposit, normalizedPayWay, amount, { absolute: true });
    }
  });

  restRows.forEach(bill => {
    const payWay = bill.payWay || '其他';
    const normalizedPayWay = normalizePayWay(payWay);
    const amount = bill.amount || 0;
    const changeType = bill.changeType;

    if (INCOME_CHANGE_TYPES.includes(changeType)) {
      incrementBucket(summaryData.restIncome, normalizedPayWay, amount);
    } else if (REFUND_CHANGE_TYPES.includes(changeType)) {
      incrementBucket(summaryData.restRefundDeposit, normalizedPayWay, amount, { absolute: true });
    }
  });

  return summaryData;
};


// 构建前端模拟表格模型
const buildFrontEndTableModel = ({ date, hotelRows, restRows, summaryData }) => ({
  date,
  hotel: {
    rows: hotelRows,
    summary: summarizeRoomData(hotelRows)
  },
  rest: {
    rows: restRows,
    summary: summarizeRoomData(restRows)
  },
  summaryDataObject: summaryData
});

describe('交接班接口集成测试', () => {
  beforeAll(async () => {
    // 获取 CSV 文件路径
    const roomsCsvPath = path.resolve(__dirname, '../../../sql/rooms.csv');
    const roomTypeCsvPath = path.resolve(__dirname, '../../../sql/room_types.csv');
    const ordersCsvPath = path.resolve(__dirname, '../../../sql/orders.csv');
    const billsCsvPath = path.resolve(__dirname, '../../../sql/bills.csv');

    // 清空相关表，防止主键冲突
    await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');

    // 动态读取 room_types.csv 首行作为列名
    const roomTypesHeaderLine = fs.readFileSync(roomTypeCsvPath, 'utf8').split('\n')[0].trim();
    await query(`
      COPY room_types(${roomTypesHeaderLine})
      FROM '${roomTypeCsvPath}'
      DELIMITER ',' CSV HEADER;
    `);

    // 动态读取 rooms.csv 首行作为列名
    const roomsHeaderLine = fs.readFileSync(roomsCsvPath, 'utf8').split('\n')[0].trim();
    await query(`
      COPY rooms(${roomsHeaderLine})
      FROM '${roomsCsvPath}'
      DELIMITER ',' CSV HEADER;
    `);

    // 动态读取 orders.csv 首行作为列名
    const ordersHeaderLine = fs.readFileSync(ordersCsvPath, 'utf8').split('\n')[0].trim();
    await query(`
      COPY orders(${ordersHeaderLine})
      FROM '${ordersCsvPath}'
      DELIMITER ',' CSV HEADER;
    `);

    // 动态读取 orders.csv 首行作为列名
    const billsHeaderLine = fs.readFileSync(billsCsvPath, 'utf8').split('\n')[0].trim();
    await query(`
      COPY bills(${billsHeaderLine})
      FROM '${billsCsvPath}'
      DELIMITER ',' CSV HEADER;
    `);
  });


  test('示例：验证数据导入是否成功', async () => {
    const res = await query('SELECT COUNT(*) FROM rooms;');
    console.log('rooms count:', res.rows[0].count);
    expect(parseInt(res.rows[0].count)).toBeGreaterThan(0);
  });

  test('测试 11-02 交接班数据', async () => {
    const targetDate = '2025-11-02';

    // 第一天没有交接班数据
    const checkYesterdayRes = await request(app)
      .get('/api/handover/check-yesterday')
      .query({ date: '2025-11-01' });

    expect(checkYesterdayRes.body).toHaveProperty('success', true);
    expect(checkYesterdayRes.body.message).toBe('无交接记录');
    expect(checkYesterdayRes.body.data.handoverAmounts).toEqual({
      cash: 0,
      wechat: 0,
      weyoufu: 0,
      other: 0
    });

    const billsRes = await request(app)
      .get(`/api/bills/by-date/${targetDate}`);

    expect(billsRes.body).toHaveProperty('success', true);

    const { hotelBills = [], restBills = [] } = billsRes.body.data || {};

    // 模拟确认账单
    const hotelRows = buildTableRows(hotelBills, targetDate);

    console.log('Hotel Rows:', hotelRows);

    const restRows = buildTableRows(restBills, targetDate);

    console.log('Rest Rows:', restRows);

    // 全部标记为已确认
    hotelRows.forEach(row => {
      row.confirmed = true;
    });
    restRows.forEach(row => {
      row.confirmed = true;
    });
    const summaryDataObject = calculateSummaryData(hotelRows, restRows);
    const tableModel = buildFrontEndTableModel({
      date: targetDate,
      hotelRows,
      restRows,
      summaryData: summaryDataObject
    });
    expect(tableModel.hotel.rows.length).toBeGreaterThan(0);
    expect(tableModel.rest.rows.length).toBeGreaterThan(0);
    expect(tableModel.hotel.rows.some(row => row.isAggregatedRoomFee)).toBe(true);
    expect(tableModel.hotel.rows.every(row => row.confirmed)).toBe(true);
    expect(tableModel.rest.rows.every(row => row.confirmed)).toBe(true);
    // 客房收入
    expect(tableModel.summaryDataObject.hotelIncome).toEqual({
      '现金': 400,
      '微信': 0,
      '微邮付': 984,
      '其他': 0
    });
    // 休息房收入
    expect(tableModel.summaryDataObject.restIncome).toEqual({
      '现金': 0,
      '微信': 0,
      '微邮付': 160,
      '其他': 0
    });
    // 客房退押
    expect(tableModel.summaryDataObject.hotelRefundDeposit).toEqual({
      '现金': 0,
      '微信': 139,
      '微邮付': 0,
      '其他': 0
    });
    // 休息退押
    expect(tableModel.summaryDataObject.restRefundDeposit).toEqual({
      '现金': 0,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });
  });

  test('测试 11-03 交接班数据', async () => {
    const targetDate = '2025-11-03';

    // 第二天有交接班数据
    const checkYesterdayRes = await request(app)
      .get('/api/handover/check-yesterday')
      .query({ date: '2025-11-02' });

    expect(checkYesterdayRes.body).toHaveProperty('success', true);
    expect(checkYesterdayRes.body.message).toBe('已完成交接');
    expect(checkYesterdayRes.body.data.handoverAmounts).toEqual({
      cash: 400,
      wechat: 139,
      weyoufu: 984,
      other: 0
    });

    const billsRes = await request(app)
      .get(`/api/bills/by-date/${targetDate}`);

    expect(billsRes.body).toHaveProperty('success', true);

    const { hotelBills = [], restBills = [] } = billsRes.body.data || {};

    // 模拟确认账单
    const hotelRows = buildTableRows(hotelBills, targetDate);
    const restRows = buildTableRows(restBills, targetDate);

    // 全部标记为已确认
    hotelRows.forEach(row => {
      row.confirmed = true;
    });
    restRows.forEach(row => {
      row.confirmed = true;
    });
    const summaryDataObject = calculateSummaryData(hotelRows, restRows);
    const tableModel = buildFrontEndTableModel({
      date: targetDate,
      hotelRows,
      restRows,
      summaryData: summaryDataObject
    });
    expect(tableModel.hotel.rows.length).toBeGreaterThan(0);
    expect(tableModel.rest.rows.length).toBeGreaterThan(0);
    expect(tableModel.hotel.rows.some(row => row.isAggregatedRoomFee)).toBe(true);
    expect(tableModel.hotel.rows.every(row => row.confirmed)).toBe(true);
    expect(tableModel.rest.rows.every(row => row.confirmed)).toBe(true);
    // 客房收入
    expect(tableModel.summaryDataObject.hotelIncome).toEqual({
      '现金': 200,
      '微信': 0,
      '微邮付': 492,
      '其他': 0
    });
    // 休息房收入
    expect(tableModel.summaryDataObject.restIncome).toEqual({
      '现金': 0,
      '微信': 0,
      '微邮付': 80,
      '其他': 0
    });
    // 客房退押
    expect(tableModel.summaryDataObject.hotelRefundDeposit).toEqual({
      '现金': 0,
      '微信': 69.5,
      '微邮付': 0,
      '其他': 0
    });
    // 休息退押
    expect(tableModel.summaryDataObject.restRefundDeposit).toEqual({
      '现金': 0,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });
  });

  afterAll(async () => {
    // 关闭数据库连接
    await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
  });

});
