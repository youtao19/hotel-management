"use strict";

const dashboardService = require("./dashboard.service");
const {
  normalizeMemoId,
  normalizeMemoPayload,
  validateMemoCreate,
  validateMemoUpdate
} = require("./dashboard.validator");

function handleError(res, error, logMessage) {
  console.error(logMessage, error);
  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  return res.status(500).json({
    message: "服务器错误",
    error: error.message
  });
}

async function listMemos(req, res) {
  try {
    const result = await dashboardService.listMemos(req.query?.date);
    return res.json({ data: result.memos, date: result.date });
  } catch (error) {
    return handleError(res, error, "获取备忘录失败:");
  }
}

async function createMemo(req, res) {
  try {
    const payload = normalizeMemoPayload(req.body || {});
    if (!validateMemoCreate(payload)) {
      return res.status(400).json({
        message: "请求数据格式错误",
        errors: validateMemoCreate.errors
      });
    }

    const memo = await dashboardService.createMemo(payload);
    return res.status(201).json({ data: memo });
  } catch (error) {
    return handleError(res, error, "创建备忘录失败:");
  }
}

async function updateMemo(req, res) {
  try {
    const memoId = normalizeMemoId(req.params?.memoId);
    if (memoId === null) {
      return res.status(400).json({ message: "备忘录ID无效" });
    }

    const payload = normalizeMemoPayload(req.body || {});
    if (!validateMemoUpdate(payload)) {
      return res.status(400).json({
        message: "请求数据格式错误",
        errors: validateMemoUpdate.errors
      });
    }

    const updated = await dashboardService.updateMemo(memoId, payload);
    if (!updated) {
      return res.status(404).json({ message: "备忘录不存在" });
    }

    return res.json({ data: updated });
  } catch (error) {
    return handleError(res, error, "更新备忘录失败:");
  }
}

async function deleteMemo(req, res) {
  try {
    const memoId = normalizeMemoId(req.params?.memoId);
    if (memoId === null) {
      return res.status(400).json({ message: "备忘录ID无效" });
    }

    const deleted = await dashboardService.deleteMemo(memoId);
    if (!deleted) {
      return res.status(404).json({ message: "备忘录不存在" });
    }

    return res.status(204).send();
  } catch (error) {
    return handleError(res, error, "删除备忘录失败:");
  }
}

module.exports = {
  createMemo,
  deleteMemo,
  listMemos,
  updateMemo
};
