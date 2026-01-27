const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const db = require('../../backend/database/postgreDB/pg');

/**
 * 解析 CSV 文本为二维数组（支持引号字段）
 */
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

/**
 * 将 bills.csv 的一条记录写入 bills 表
 */
async function insertBillRowFromCsvRecord(record) {
  const toNullIfEmpty = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    return text.trim() === '' ? null : text;
  };

  await db.query(
    `
      INSERT INTO bills (
        bill_id,
        order_id,
        room_number,
        guest_name,
        change_price,
        change_type,
        pay_way,
        create_time,
        remarks,
        stay_type,
        stay_date
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
    `,
    [
      toNullIfEmpty(record.bill_id),
      toNullIfEmpty(record.order_id),
      toNullIfEmpty(record.room_number),
      toNullIfEmpty(record.guest_name),
      toNullIfEmpty(record.change_price),
      toNullIfEmpty(record.change_type),
      toNullIfEmpty(record.pay_way),
      toNullIfEmpty(record.create_time),
      toNullIfEmpty(record.remarks),
      toNullIfEmpty(record.stay_type),
      toNullIfEmpty(record.stay_date)
    ]
  );
}

/**
 * 交接班用例会从 bills.csv 显式插入 bill_id。
 * Postgres 的 SERIAL/SEQUENCE 不会因为手动插入而自动前移，
 * 需要在导入完成后手动 setval，否则后续业务插入账单会触发 bills_pkey 重复。
 */
async function syncBillsSequence() {
  await db.query(
    `SELECT setval(
        pg_get_serial_sequence('bills','bill_id'),
        COALESCE((SELECT MAX(bill_id) FROM bills), 1)
      );`
  );
}

/**
 * 启动交接班流程并进入第 1 步
 */
async function startHandoverFlow(page) {
  // 进入交接班页面
  await page.goto('http://localhost:9011/handover');

  // 点击“开始交接班”并确认弹窗
  await page.getByRole('button', { name: '开始交接班' }).click();
  await page.getByRole('button', { name: '确定' }).click();

  // 等待步骤 1 标题出现，确保流程开始
  await expect(page.getByText('昨日交接记录检查')).toBeVisible();
}

/**
 * 检查昨日交接记录并等待结果展示
 */
async function checkYesterdayRecord(page) {
  // 点击“检查昨日记录”
  await page.getByRole('button', { name: '检查昨日记录' }).click();

  // 等待结果提示条出现
  const recordBanner = page.locator('.q-banner').filter({ hasText: '昨日记录' });
  await expect(recordBanner).toBeVisible();
}

/**
 * 确认备用金并进入下一步
 */
async function confirmReserveCash(page) {
  // 点击“确认备用金”
  await page.getByRole('button', { name: '确认备用金' }).click();
}

/**
 * 若存在数据行则一键确认，再完成数据核对
 */
async function confirmDataCheck(page) {
  // 尝试逐个点击“一键确认”，避免数据存在但未确认导致无法继续
  const confirmAllButtons = page.getByRole('button', { name: '一键确认' });
  const confirmAllCount = await confirmAllButtons.count();

  for (let index = 0; index < confirmAllCount; index += 1) {
    const button = confirmAllButtons.nth(index);
    if (await button.isEnabled()) {
      await button.click();
    }
  }

  // 点击“确认核对”完成步骤 3
  const confirmButton = page.getByRole('button', { name: '确认核对' });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  // 校验按钮变更为“数据核对已完成”
  await expect(page.getByRole('button', { name: '数据核对已完成' })).toBeVisible();
}

/**
 * 点击通用“下一步”按钮
 */
async function goToNextStep(page) {
  await page.getByRole('button', { name: '下一步' }).click();
}

test.describe('交接班测试', () => {
  test.beforeAll(async () => {
    // 确保测试进程内的数据库连接池已初始化
    process.env.NODE_ENV = 'test';
    db.createPool();

    // 手动导入 bills.csv 数据，确保交接班页面有可用账单
    await db.query('TRUNCATE TABLE bills RESTART IDENTITY CASCADE;');

    const billsCsvPath = path.resolve(__dirname, '../../sql/bills.csv');
    const csvText = fs.readFileSync(billsCsvPath, 'utf8');
    const csvRows = parseCsv(csvText);
    const header = csvRows[0] || [];

    for (let i = 1; i < csvRows.length; i += 1) {
      const row = csvRows[i];
      if (!row || row.length === 0) continue;

      const record = {};
      for (let c = 0; c < header.length; c += 1) {
        record[header[c]] = row[c];
      }

      await insertBillRowFromCsvRecord(record);
    }

    // 导入完成后同步 bills 的自增序列，避免影响后续测试用例创建账单。
    await syncBillsSequence();
  });

  test('打开交接班页面并查看今日交接记录', async ({ page }) => {
    // 启动交接班流程
    await startHandoverFlow(page);

    // 步骤 1：检查昨日记录并进入步骤 2
    await checkYesterdayRecord(page);
    await goToNextStep(page);

    // 步骤 2：确认备用金并进入步骤 3
    await confirmReserveCash(page);
    await goToNextStep(page);

    // 步骤 3：确认核对交接数据并进入步骤 4
    await expect(page.getByText('请核对交接数据')).toBeVisible();
    await confirmDataCheck(page);
    await goToNextStep(page);

    // 步骤 4：确认交接数据展示无误并进入步骤 5
    await expect(page.getByRole('columnheader', { name: '交接班' })).toBeVisible();
    await goToNextStep(page);

    // 步骤 5：填写接班信息并完成交接
    await page.getByRole('textbox', { name: '接班人员' }).fill('自动化测试接班人');
    await page.getByRole('textbox', { name: '交接备注' }).fill('自动化测试交接备注');
    await page.getByRole('button', { name: '完成交接' }).click();

    // 步骤 6：校验交接完成页面出现
    await expect(page.getByText('交接班完成')).toBeVisible();
  });
});
