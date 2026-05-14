"use strict";

const repository = require("./dashboard.repository");
const { normalizeMemoDate, normalizeMemoPayload } = require("./dashboard.validator");

async function listMemos(rawDate) {
  const memoDate = normalizeMemoDate(rawDate || new Date());
  if (!memoDate) {
    const error = new Error("日期格式无效");
    error.statusCode = 400;
    throw error;
  }

  const memos = await repository.findMemosByDate(memoDate);
  return { memos, date: memoDate };
}

async function createMemo(payload) {
  const normalized = normalizeMemoPayload(payload);
  return repository.insertMemo({
    memo_date: normalized.memo_date,
    title: normalized.title,
    priority: normalized.priority || "medium",
    completed: normalized.completed === true
  });
}

async function updateMemo(memoId, payload) {
  return repository.updateMemoById(memoId, normalizeMemoPayload(payload));
}

async function deleteMemo(memoId) {
  return repository.deleteMemoById(memoId);
}

module.exports = {
  createMemo,
  deleteMemo,
  listMemos,
  updateMemo
};
