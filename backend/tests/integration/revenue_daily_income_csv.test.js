const request = require('supertest');
const app = require('../../app');
const path = require('path');
const fs = require('fs');
const tools = require('../tools');
const { query } = require('../../database/postgreDB/pg');

// 中文注释：简易 CSV 解析（支持引号字段），用于把 sql/orders.csv 导入到 orders 表
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (ch === '\r') {
      continue;
    }

    field += ch;
  }

  // 处理最后一行（文件末尾可能没有换行）
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// 中文注释：将 orders.csv 的一行数据写入 orders 表（不使用 psql 的 \copy，避免测试环境依赖）
async function insertOrderRowFromCsvRecord(record) {
  const toNullIfEmpty = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return s.trim() === '' ? null : s;
  };

  await query(
    `
      INSERT INTO orders (
        order_id,
        id_source,
        order_source,
        guest_name,
        phone,
        room_type,
        room_number,
        check_in_date,
        check_out_date,
        stay_date,
        status,
        payment_method,
        total_price,
        deposit,
        create_time,
        stay_type,
        remarks,
        is_prepaid,
        prepaid_amount
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
    `,
    [
      toNullIfEmpty(record.order_id),
      toNullIfEmpty(record.id_source),
      toNullIfEmpty(record.order_source),
      toNullIfEmpty(record.guest_name),
      toNullIfEmpty(record.phone),
      toNullIfEmpty(record.room_type),
      toNullIfEmpty(record.room_number),
      toNullIfEmpty(record.check_in_date),
      toNullIfEmpty(record.check_out_date),
      toNullIfEmpty(record.stay_date),
      toNullIfEmpty(record.status),
      toNullIfEmpty(record.payment_method),
      toNullIfEmpty(record.total_price),
      toNullIfEmpty(record.deposit),
      toNullIfEmpty(record.create_time),
      toNullIfEmpty(record.stay_type),
      toNullIfEmpty(record.remarks),
      toNullIfEmpty(record.is_prepaid),
      toNullIfEmpty(record.prepaid_amount),
    ]
  );
}

describe('收入统计：单日收入（导入 sql/orders.csv）', () => {
  beforeAll(async () => {
    // 中文注释：清空相关表，避免测试数据相互影响（包含外键依赖）
    await query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE orders RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
    await query('TRUNCATE TABLE room_types RESTART IDENTITY CASCADE;');

    // 中文注释：导入房型与房间，避免 orders 的外键约束失败
    await tools.addRoomType(tools.roomTypes);
    await tools.addRoom(tools.rooms);

    // 中文注释：导入 orders.csv（注意：这里是 CSV，不是 orders.sql）
    const ordersCsvPath = path.resolve(__dirname, '../../../sql/orders.csv');
    const csvText = fs.readFileSync(ordersCsvPath, 'utf8');
    const csvRows = parseCsv(csvText);
    const header = csvRows[0] || [];

    for (let i = 1; i < csvRows.length; i += 1) {
      const row = csvRows[i];
      if (!row || row.length === 0) continue;

      const record = {};
      for (let c = 0; c < header.length; c += 1) {
        record[header[c]] = row[c];
      }

      await insertOrderRowFromCsvRecord(record);
    }
  });

  test('CSV 数据插入成功', async () => {
    const res = await query("SELECT guest_name FROM orders WHERE order_id = 'O202511023155'");
    expect(res.rows[0].guest_name).toBe('张安林');
  });

  test.each([
    ['2025-11-02', 3115.14],
    ['2025-11-03', 3233.97],
    ['2025-11-04', 3462.66],
    ['2025-11-05', 3675.12],
    ['2025-11-06', 2891.76],
    ['2025-11-07', 4845.85],
  ])('单日收入统计：%s', async (dateStr, expectedRevenue) => {
    const res = await request(app)
      // 中文注释：单日收入使用 quick-stats 的 today 口径（startDate=endDate）
      .get('/api/revenue/quick-stats')
      .query({ startDate: dateStr, endDate: dateStr });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.today.total_revenue).toBe(expectedRevenue);
  });
});
