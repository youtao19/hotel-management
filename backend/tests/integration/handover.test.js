const path = require('path');
const fs = require('fs');
const request = require('supertest');
const Decimal = require('decimal.js');
const app = require('../../app');
const { query } = require('../../database/postgreDB/pg');

// Helpers mirroring the CheckData.vue data preparation flow
const PAY_WAY_KEYS = ['现金', '微信', '微邮付', '其他'];
const DEFAULT_RESERVE_CASH = 320;
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

const cloneBucket = (bucket = {}) => createPaywayBucket(bucket);

const addBuckets = (...buckets) => {
  const result = createPaywayBucket();
  buckets.filter(Boolean).forEach(bucket => {
    PAY_WAY_KEYS.forEach(key => {
      const current = toDecimal(result[key]);
      const addition = toDecimal(bucket?.[key] || 0);
      result[key] = toAmountNumber(current.plus(addition));
    });
  });
  return result;
};

// 构建交接班支付数据
const buildPaymentDataPayload = (summaryDataObject = {}, options = {}) => {
  const reserve = cloneBucket(options.reserveBucket || { '现金': DEFAULT_RESERVE_CASH });
  const hotelIncome = cloneBucket(summaryDataObject.hotelIncome);
  const restIncome = cloneBucket(summaryDataObject.restIncome);
  const carRentIncome = cloneBucket(options.carRentBucket);
  const hotelDeposit = cloneBucket(summaryDataObject.hotelRefundDeposit);
  const restDeposit = cloneBucket(summaryDataObject.restRefundDeposit);
  const totalIncome = addBuckets(reserve, hotelIncome, restIncome, carRentIncome);
  const totalRefundDeposit = addBuckets(hotelDeposit, restDeposit);
  const retainedAmount = createPaywayBucket();
  const handoverAmount = createPaywayBucket();

  PAY_WAY_KEYS.forEach(key => {
    const total = toDecimal(totalIncome[key]);
    const refund = toDecimal(totalRefundDeposit[key]);
    const retained = toDecimal(retainedAmount[key]);
    handoverAmount[key] = toAmountNumber(total.minus(refund).minus(retained));
  });


  // 金额计算
  PAY_WAY_KEYS.forEach(key => {
    totalIncome[key] = reserve[key] + hotelIncome[key] + restIncome[key] + (carRentIncome ? carRentIncome[key] : 0);
    if(key === '现金') {
      retainedAmount[key] = 320;
    }
    handoverAmount[key] = totalIncome[key] - totalRefundDeposit[key] - retainedAmount[key];
  });


  return {
    reserve,
    hotelIncome,
    restIncome,
    carRentIncome,
    totalIncome,
    hotelDeposit,
    restDeposit,
    totalRefundDeposit,
    retainedAmount,
    handoverAmount
  };
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
    const roomsSqlPath = path.resolve(__dirname, '../../../sql/rooms.sql');
    const roomTypesSqlPath = path.resolve(__dirname, '../../../sql/room_types.sql');
    const ordersSqlPath = path.resolve(__dirname, '../../../sql/orders.sql');
    const billsSqlPath = path.resolve(__dirname, '../../../sql/bills.sql');
    const executeSqlFile = async (filePath) => {
      const sql = fs.readFileSync(filePath, 'utf8').trim();
      if (sql) {
        await query(sql);
      }
    };

    // 清空相关表，防止主键冲突
    await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');

    await executeSqlFile(roomTypesSqlPath);
    await executeSqlFile(roomsSqlPath);
    await executeSqlFile(ordersSqlPath);
    await executeSqlFile(billsSqlPath);
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
      weiyoufu: 0,
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

    // 完成交接班
    const paymentDataPayload = buildPaymentDataPayload(summaryDataObject, {
      reserveBucket: { '微信': 2336.5 , '现金': 320 },
    });

    const completeHandoverRes = await request(app)
      .post('/api/handover/complete')
      .send({
        date: targetDate,
        handoverPerson: 'youtao',
        receivePerson: 'peach',
        paymentData: paymentDataPayload,
        vipCard: 6,
        taskList: [],
        notes: "第一天交接班完成"
      });


    expect(completeHandoverRes.body.success).toBe(true);
    expect(completeHandoverRes.body.data.recordCount).toBe(4);
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
      'cash': 400,
      'wechat': 2197.5,
      'weiyoufu': 1144,
      'other': 0
    });

    const reserve = checkYesterdayRes.body.data.handoverAmounts;
    reserve['现金'] = 320; // 固定留存现金
    reserve['微信'] = 2197.5;

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
      '现金': 100,
      '微信': 0,
      '微邮付': 1434,
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
      '现金': 95,
      '微信': 20,
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

    // 完成交接班
    const paymentDataPayload = buildPaymentDataPayload(summaryDataObject,{
      reserveBucket: reserve
    });

    const completeHandoverRes = await request(app)
      .post('/api/handover/complete')
      .send({
        date: targetDate,
        handoverPerson: 'youtao',
        receivePerson: 'peach',
        paymentData: paymentDataPayload,
        vipCard: 6,
        taskList: [],
        notes: "第二天交接班完成"
      });

    expect(completeHandoverRes.body).toHaveProperty('success', true);
    expect(completeHandoverRes.body.data.recordCount).toBe(4);
  });

  test('测试 11-04 交接班数据', async () => {
    const targetDate = '2025-11-04';

    // 第三天有交接班数据
    const checkYesterdayRes = await request(app)
      .get('/api/handover/check-yesterday')
      .query({ date: '2025-11-03' });

    expect(checkYesterdayRes.body).toHaveProperty('success', true);
    expect(checkYesterdayRes.body.message).toBe('已完成交接');
    expect(checkYesterdayRes.body.data.handoverAmounts).toEqual({
      'cash': 5,
      'wechat': 2177.5,
      'weiyoufu': 1514,
      'other': 0
    });

    const reserve = checkYesterdayRes.body.data.handoverAmounts;
    reserve['现金'] = 320; // 固定留存现金
    reserve['微信'] = 2177.5;

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
      '现金': 0,
      '微信': 170,
      '微邮付': 924,
      '其他': 0
    });
    // 休息房收入
    expect(tableModel.summaryDataObject.restIncome).toEqual({
      '现金': 100,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });
    // 客房退押
    expect(tableModel.summaryDataObject.hotelRefundDeposit).toEqual({
      '现金': 0,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });
    // 休息退押
    expect(tableModel.summaryDataObject.restRefundDeposit).toEqual({
      '现金': 20,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });

    // 完成交接班
    const paymentDataPayload = buildPaymentDataPayload(summaryDataObject,{
      reserveBucket: reserve
    });

    const completeHandoverRes = await request(app)
      .post('/api/handover/complete')
      .send({
        date: targetDate,
        handoverPerson: 'youtao',
        receivePerson: 'peach',
        paymentData: paymentDataPayload,
        vipCard: 6,
        taskList: [],
        notes: "第三天交接班完成"
      });

    expect(completeHandoverRes.body).toHaveProperty('success', true);
    expect(completeHandoverRes.body.data.recordCount).toBe(4);
  });

  test('测试 11-05 交接班数据', async () => {
    const targetDate = '2025-11-05';

    // 第四天有交接班数据
    const checkYesterdayRes = await request(app)
      .get('/api/handover/check-yesterday')
      .query({ date: '2025-11-04' });

    expect(checkYesterdayRes.body).toHaveProperty('success', true);
    expect(checkYesterdayRes.body.message).toBe('已完成交接');
    expect(checkYesterdayRes.body.data.handoverAmounts).toEqual({
      'cash': 80,
      'wechat': 2347.5,
      'weiyoufu': 924,
      'other': 0
    });

    const reserve = checkYesterdayRes.body.data.handoverAmounts;
    reserve['现金'] = 320; // 固定留存现金
    reserve['微信'] = 2347.5;

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
    expect(tableModel.hotel.rows.every(row => row.confirmed)).toBe(true);
    expect(tableModel.rest.rows.every(row => row.confirmed)).toBe(true);
    // 客房收入
    expect(tableModel.summaryDataObject.hotelIncome).toEqual({
      '现金': 360,
      '微信': 0,
      '微邮付': 838,
      '其他': 0
    });
    // 休息房收入
    expect(tableModel.summaryDataObject.restIncome).toEqual({
      '现金': 100,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });
    // 客房退押
    expect(tableModel.summaryDataObject.hotelRefundDeposit).toEqual({
      '现金': 70,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });
    // 休息退押
    expect(tableModel.summaryDataObject.restRefundDeposit).toEqual({
      '现金': 20,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });

    // 完成交接班
    const paymentDataPayload = buildPaymentDataPayload(summaryDataObject,{
      reserveBucket: reserve
    });

    const completeHandoverRes = await request(app)
      .post('/api/handover/complete')
      .send({
        date: targetDate,
        handoverPerson: 'youtao',
        receivePerson: 'peach',
        paymentData: paymentDataPayload,
        vipCard: 6,
        taskList: [],
        notes: "第四天交接班完成"
      });

    expect(completeHandoverRes.body).toHaveProperty('success', true);
    expect(completeHandoverRes.body.data.recordCount).toBe(4);
  });

  test('测试 11-06 交接班数据', async () => {
    const targetDate = '2025-11-06';

    // 第五天有交接班数据
    const checkYesterdayRes = await request(app)
      .get('/api/handover/check-yesterday')
      .query({ date: '2025-11-05' });

    expect(checkYesterdayRes.body).toHaveProperty('success', true);
    expect(checkYesterdayRes.body.message).toBe('已完成交接');
    expect(checkYesterdayRes.body.data.handoverAmounts).toEqual({
      'cash': 370,
      'wechat': 2347.5,
      'weiyoufu': 838,
      'other': 0
    });

    const reserve = checkYesterdayRes.body.data.handoverAmounts;
    reserve['现金'] = 320; // 固定留存现金
    reserve['微信'] = 2347.5;

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
    expect(tableModel.hotel.rows.every(row => row.confirmed)).toBe(true);
    expect(tableModel.rest.rows.every(row => row.confirmed)).toBe(true);
    // 客房收入
    expect(tableModel.summaryDataObject.hotelIncome).toEqual({
      '现金': 370,
      '微信': 0,
      '微邮付': 1678,
      '其他': 0
    });
    // 休息房收入
    expect(tableModel.summaryDataObject.restIncome).toEqual({
      '现金': 150,
      '微信': 0,
      '微邮付': 140,
      '其他': 0
    });
    // 客房退押
    expect(tableModel.summaryDataObject.hotelRefundDeposit).toEqual({
      '现金': 20,
      '微信': 80,
      '微邮付': 0,
      '其他': 0
    });
    // 休息退押
    expect(tableModel.summaryDataObject.restRefundDeposit).toEqual({
      '现金': 20,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });

    // 完成交接班
    const paymentDataPayload = buildPaymentDataPayload(summaryDataObject,{
      reserveBucket: reserve
    });

    const completeHandoverRes = await request(app)
      .post('/api/handover/complete')
      .send({
        date: targetDate,
        handoverPerson: 'youtao',
        receivePerson: 'peach',
        paymentData: paymentDataPayload,
        vipCard: 6,
        taskList: [],
        notes: "第四天交接班完成"
      });

    expect(completeHandoverRes.body).toHaveProperty('success', true);
    expect(completeHandoverRes.body.data.recordCount).toBe(4);
  });

  test('测试 11-07 交接班数据', async () => {
    const targetDate = '2025-11-07';

    // 第六天有交接班数据
    const checkYesterdayRes = await request(app)
      .get('/api/handover/check-yesterday')
      .query({ date: '2025-11-06' });

    expect(checkYesterdayRes.body).toHaveProperty('success', true);
    expect(checkYesterdayRes.body.message).toBe('已完成交接');
    expect(checkYesterdayRes.body.data.handoverAmounts).toEqual({
      'cash': 480,
      'wechat': 2267.50,
      'weiyoufu': 1818,
      'other': 0
    });

    const reserve = checkYesterdayRes.body.data.handoverAmounts;
    reserve['现金'] = 320; // 固定留存现金
    reserve['微信'] = 2267.50;

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
    expect(tableModel.hotel.rows.every(row => row.confirmed)).toBe(true);
    expect(tableModel.rest.rows.every(row => row.confirmed)).toBe(true);
    // 客房收入
    expect(tableModel.summaryDataObject.hotelIncome).toEqual({
      '现金': 410,
      '微信': 660,
      '微邮付': 760,
      '其他': 0
    });
    // 休息房收入
    expect(tableModel.summaryDataObject.restIncome).toEqual({
      '现金': 100,
      '微信': 0,
      '微邮付': 100,
      '其他': 0
    });
    // 客房退押
    expect(tableModel.summaryDataObject.hotelRefundDeposit).toEqual({
      '现金': 0,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });
    // 休息退押
    expect(tableModel.summaryDataObject.restRefundDeposit).toEqual({
      '现金': 40,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });

    // 完成交接班
    const paymentDataPayload = buildPaymentDataPayload(summaryDataObject,{
      reserveBucket: reserve
    });

    const completeHandoverRes = await request(app)
      .post('/api/handover/complete')
      .send({
        date: targetDate,
        handoverPerson: 'youtao',
        receivePerson: 'peach',
        paymentData: paymentDataPayload,
        vipCard: 6,
        taskList: [],
        notes: "第四天交接班完成"
      });

    expect(completeHandoverRes.body).toHaveProperty('success', true);
    expect(completeHandoverRes.body.data.recordCount).toBe(4);
  });

  test('测试 11-08 交接班数据', async () => {
    const targetDate = '2025-11-08';

    // 第七天有交接班数据
    const checkYesterdayRes = await request(app)
      .get('/api/handover/check-yesterday')
      .query({ date: '2025-11-07' });

    expect(checkYesterdayRes.body).toHaveProperty('success', true);
    expect(checkYesterdayRes.body.message).toBe('已完成交接');
    expect(checkYesterdayRes.body.data.handoverAmounts).toEqual({
      'cash': 470,
      'wechat': 2927.50,
      'weiyoufu': 860,
      'other': 0
    });

    const reserve = checkYesterdayRes.body.data.handoverAmounts;
    reserve['现金'] = 320; // 固定留存现金
    reserve['微信'] = 2927.50;

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
    expect(tableModel.hotel.rows.every(row => row.confirmed)).toBe(true);
    expect(tableModel.rest.rows.every(row => row.confirmed)).toBe(true);
    // 客房收入
    expect(tableModel.summaryDataObject.hotelIncome).toEqual({
      '现金': 0,
      '微信': 80,
      '微邮付': 436,
      '其他': 0
    });
    // 休息房收入
    expect(tableModel.summaryDataObject.restIncome).toEqual({
      '现金': 0,
      '微信': 0,
      '微邮付': 0,
      '其他': 0
    });
    // 客房退押
    expect(tableModel.summaryDataObject.hotelRefundDeposit).toEqual({
      '现金': 0,
      '微信': 0,
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

    // 完成交接班
    const paymentDataPayload = buildPaymentDataPayload(summaryDataObject,{
      reserveBucket: reserve
    });

    const completeHandoverRes = await request(app)
      .post('/api/handover/complete')
      .send({
        date: targetDate,
        handoverPerson: 'youtao',
        receivePerson: 'peach',
        paymentData: paymentDataPayload,
        vipCard: 6,
        taskList: [],
        notes: "第四天交接班完成"
      });

    expect(completeHandoverRes.body).toHaveProperty('success', true);
    expect(completeHandoverRes.body.data.recordCount).toBe(4);
  });

  test('测试 11-09 交接班数据', async () => {
    const targetDate = '2025-11-09';

    // 第八天有交接班数据
    const checkYesterdayRes = await request(app)
      .get('/api/handover/check-yesterday')
      .query({ date: '2025-11-08' });

    expect(checkYesterdayRes.body).toHaveProperty('success', true);
    expect(checkYesterdayRes.body.message).toBe('已完成交接');
    expect(checkYesterdayRes.body.data.handoverAmounts).toEqual({
      'cash': 0,
      'wechat': 3007.50,
      'weiyoufu': 436,
      'other': 0
    });

    const reserve = checkYesterdayRes.body.data.handoverAmounts;
    reserve['现金'] = 320; // 固定留存现金
    reserve['微信'] = 3007.50;

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
    expect(tableModel.hotel.rows.every(row => row.confirmed)).toBe(true);
    expect(tableModel.rest.rows.every(row => row.confirmed)).toBe(true);
    // 客房收入
    expect(tableModel.summaryDataObject.hotelIncome).toEqual({
      '现金': 0,
      '微信': 0,
      '微邮付': 410,
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
      '微信': 0,
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

    // 完成交接班
    const paymentDataPayload = buildPaymentDataPayload(summaryDataObject,{
      reserveBucket: reserve
    });

    const completeHandoverRes = await request(app)
      .post('/api/handover/complete')
      .send({
        date: targetDate,
        handoverPerson: 'youtao',
        receivePerson: 'peach',
        paymentData: paymentDataPayload,
        vipCard: 6,
        taskList: [],
        notes: "第四天交接班完成"
      });

    expect(completeHandoverRes.body).toHaveProperty('success', true);
    expect(completeHandoverRes.body.data.recordCount).toBe(4);
  });

  test('测试 11-02 开房数', async () => {
    const targetDate = '2025-11-02';
    const openCountRes = await request(app)
      .get('/api/handover/special-stats')
      .query({ date: targetDate });

    expect(openCountRes.body).toHaveProperty('success', true);
    expect(openCountRes.body.data.openCount).toBe(25);
    expect(openCountRes.body.data.restCount).toBe(2);
  })

  test('测试 11-03 开房数', async () => {
    const targetDate = '2025-11-03';
    const openCountRes = await request(app)
      .get('/api/handover/special-stats')
      .query({ date: targetDate });

    expect(openCountRes.body).toHaveProperty('success', true);
    expect(openCountRes.body.data.openCount).toBe(28);
    expect(openCountRes.body.data.restCount).toBe(1);
  })

  test('测试 11-04 开房数', async () => {
    const targetDate = '2025-11-04';
    const openCountRes = await request(app)
      .get('/api/handover/special-stats')
      .query({ date: targetDate });

    expect(openCountRes.body).toHaveProperty('success', true);
    expect(openCountRes.body.data.openCount).toBe(28);
    expect(openCountRes.body.data.restCount).toBe(1);
  })

  test('测试 11-05 开房数', async () => {
    const targetDate = '2025-11-05';
    const openCountRes = await request(app)
      .get('/api/handover/special-stats')
      .query({ date: targetDate });

    expect(openCountRes.body).toHaveProperty('success', true);
    expect(openCountRes.body.data.openCount).toBe(31);
    expect(openCountRes.body.data.restCount).toBe(1);
  })

  test('测试 11-06 开房数', async () => {
    const targetDate = '2025-11-06';
    const openCountRes = await request(app)
      .get('/api/handover/special-stats')
      .query({ date: targetDate });

    expect(openCountRes.body).toHaveProperty('success', true);
    expect(openCountRes.body.data.openCount).toBe(22);
    expect(openCountRes.body.data.restCount).toBe(3);
  })

  test('测试 11-07 开房数', async () => {
    const targetDate = '2025-11-07';
    const openCountRes = await request(app)
      .get('/api/handover/special-stats')
      .query({ date: targetDate });

    expect(openCountRes.body).toHaveProperty('success', true);
    expect(openCountRes.body.data.openCount).toBe(33);
    expect(openCountRes.body.data.restCount).toBe(2);
  })

  afterAll(async () => {
    // 关闭数据库连接
    await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
  });

});
