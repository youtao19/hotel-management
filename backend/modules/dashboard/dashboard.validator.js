"use strict";

const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const { formatDate } = require("../tools");

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const PRIORITY_VALUES = ["low", "medium", "high"];

const memoCreateSchema = {
  type: "object",
  properties: {
    memo_date: { type: "string", format: "date" },
    title: { type: "string", minLength: 1, maxLength: 255 },
    priority: { type: "string", enum: PRIORITY_VALUES },
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
    priority: { type: "string", enum: PRIORITY_VALUES },
    completed: { type: "boolean" }
  },
  additionalProperties: false,
  minProperties: 1
};

const validateMemoCreate = ajv.compile(memoCreateSchema);
const validateMemoUpdate = ajv.compile(memoUpdateSchema);

function normalizeMemoDate(dateInput) {
  try {
    return formatDate(dateInput);
  } catch {
    return null;
  }
}

function normalizeMemoId(memoIdInput) {
  const memoId = Number.parseInt(memoIdInput, 10);
  return Number.isNaN(memoId) ? null : memoId;
}

function normalizeMemoPayload(payload = {}) {
  return {
    ...payload,
    title: typeof payload.title === "string" ? payload.title.trim() : payload.title
  };
}

module.exports = {
  PRIORITY_VALUES,
  memoCreateSchema,
  memoUpdateSchema,
  normalizeMemoDate,
  normalizeMemoId,
  normalizeMemoPayload,
  validateMemoCreate,
  validateMemoUpdate
};
