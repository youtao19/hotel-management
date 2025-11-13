"use strict";
const express = require("express");
const router = express.Router();
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const memoModule = require("../modules/dashboardMemoModule");

const ajv = new Ajv({ allErrors: true, removeAdditional: "failing" });
addFormats(ajv);

const PRIORITY_ENUM = ["low", "medium", "high"];

const memoCreateSchema = {
  type: "object",
  properties: {
    memo_date: { type: "string", format: "date" },
    title: { type: "string", minLength: 1, maxLength: 255 },
    priority: { type: "string", enum: PRIORITY_ENUM },
    completed: { type: "boolean" }
  },
  required: ["memo_date", "title"],
  additionalProperties: false
};

const memoUpdateSchema = {
  type: "object",
  properties: {
    memo_date: { type: "string", format: "date" },
    title: { type: "string", minLength: 1, maxLength: 255 },
    priority: { type: "string", enum: PRIORITY_ENUM },
    completed: { type: "boolean" }
  },
  additionalProperties: false,
  minProperties: 1
};

const validateCreate = ajv.compile(memoCreateSchema);
const validateUpdate = ajv.compile(memoUpdateSchema);

function formatDateToISO(dateInput) {
  if (typeof dateInput === "string") {
    return dateInput;
  }
  const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(dateObj.getTime())) {
    return null;
  }
  return dateObj.toISOString().slice(0, 10);
}

router.get("/", async (req, res) => {
  try {
    const queryDate = req.query.date;
    const formattedDate = formatDateToISO(queryDate || new Date());

    if (!formattedDate) {
      return res.status(400).json({ message: "日期格式无效" });
    }

    const memos = await memoModule.getMemosByDate(formattedDate);
    res.json({ data: memos, date: formattedDate });
  } catch (error) {
    console.error("获取备忘录失败:", error);
    res.status(500).json({ message: "服务器错误", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      title: typeof req.body.title === "string" ? req.body.title.trim() : req.body.title
    };

    if (!validateCreate(payload)) {
      return res.status(400).json({ message: "请求数据格式错误", errors: validateCreate.errors });
    }

    const memo = await memoModule.createMemo({
      memo_date: payload.memo_date,
      title: payload.title,
      priority: payload.priority || "medium",
      completed: payload.completed === true
    });

    res.status(201).json({ data: memo });
  } catch (error) {
    console.error("创建备忘录失败:", error);
    res.status(500).json({ message: "服务器错误", error: error.message });
  }
});

router.put("/:memoId", async (req, res) => {
  try {
    const memoId = Number.parseInt(req.params.memoId, 10);
    if (Number.isNaN(memoId)) {
      return res.status(400).json({ message: "备忘录ID无效" });
    }

    const payload = {
      ...req.body,
      title: typeof req.body.title === "string" ? req.body.title.trim() : req.body.title
    };

    if (!validateUpdate(payload)) {
      return res.status(400).json({ message: "请求数据格式错误", errors: validateUpdate.errors });
    }

    const updated = await memoModule.updateMemo(memoId, payload);
    if (!updated) {
      return res.status(404).json({ message: "备忘录不存在" });
    }

    res.json({ data: updated });
  } catch (error) {
    console.error("更新备忘录失败:", error);
    res.status(500).json({ message: "服务器错误", error: error.message });
  }
});

router.delete("/:memoId", async (req, res) => {
  try {
    const memoId = Number.parseInt(req.params.memoId, 10);
    if (Number.isNaN(memoId)) {
      return res.status(400).json({ message: "备忘录ID无效" });
    }

    const deleted = await memoModule.deleteMemo(memoId);
    if (!deleted) {
      return res.status(404).json({ message: "备忘录不存在" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("删除备忘录失败:", error);
    res.status(500).json({ message: "服务器错误", error: error.message });
  }
});

module.exports = router;
