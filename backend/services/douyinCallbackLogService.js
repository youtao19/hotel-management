"use strict";

const fs = require('fs/promises');
const path = require('path');

const DEFAULT_LOG_FILE = path.join(__dirname, '..', 'logs', 'douyin-callback-logid.jsonl');

function getLogFilePath() {
  return process.env.DOUYIN_CALLBACK_LOG_FILE || DEFAULT_LOG_FILE;
}

function formatLocalTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

async function appendLog(record = {}) {
  if (!record.logId) {
    return false;
  }

  const logFile = getLogFilePath();
  await fs.mkdir(path.dirname(logFile), { recursive: true });
  await fs.appendFile(
    logFile,
    `${JSON.stringify({
      receivedAt: formatLocalTime(),
      ...record
    })}\n`,
    'utf8'
  );

  return true;
}

module.exports = {
  appendLog,
  getLogFilePath
};
