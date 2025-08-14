"use strict";

const { query } = require('../pg');

async function migrate() {
  console.log('[migration] make_refund_time_nullable: start');
  try {
    await query(`ALTER TABLE bills ALTER COLUMN refund_time DROP NOT NULL;`);
  } catch (e) {
    if (!/cannot alter type of a column|not null/i.test(e.message)) {
      console.warn('[migration] alter column notice:', e.message);
    }
  }
  const res = await query(`UPDATE bills SET refund_time = NULL WHERE (refund_deposit = 0 OR refund_deposit IS NULL) AND refund_time IS NOT NULL;`);
  console.log(`[migration] make_refund_time_nullable: cleaned rows = ${res.rowCount}`);
  console.log('[migration] make_refund_time_nullable: done');
}

async function rollback() {
  console.log('[migration] make_refund_time_nullable rollback: skipped');
}

module.exports = { migrate, rollback };
