"use strict";

const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const ajv = new Ajv({ allErrors: true, removeAdditional: "failing", coerceTypes: true });
addFormats(ajv);

const PAYMENT_METHODS = ["现金", "微信", "微邮付", "其他"];

function formatAjvErrors(errors = []) {
  return errors.map((error) => {
    const path = error.instancePath ? error.instancePath.replace(/^\//, "") : "";
    const field = path || error.params?.missingProperty || "";
    return {
      field,
      message: error.message
    };
  });
}

function createPaymentBucketSchema() {
  return {
    type: "object",
    properties: PAYMENT_METHODS.reduce((acc, method) => {
      acc[method] = { type: "number" };
      return acc;
    }, {}),
    required: PAYMENT_METHODS,
    additionalProperties: false
  };
}

const paymentBucketSchema = createPaymentBucketSchema();

const requiredDateQuerySchema = {
  type: "object",
  properties: {
    date: { type: "string", format: "date" }
  },
  required: ["date"],
  additionalProperties: false
};

const completeHandoverSchema = {
  type: "object",
  properties: {
    date: { type: "string", format: "date" },
    handoverPerson: { type: "string", minLength: 1, maxLength: 100 },
    receivePerson: { type: "string", minLength: 1, maxLength: 100 },
    retainedAmount: paymentBucketSchema,
    vipCard: { type: "number", minimum: 0 },
    notes: { type: "string", maxLength: 2000 }
  },
  required: ["date", "receivePerson"],
  additionalProperties: false
};

const validateRequiredDateQuery = ajv.compile(requiredDateQuerySchema);
const validateCompleteHandover = ajv.compile(completeHandoverSchema);

function sanitizeQuery(query = {}) {
  return Object.keys(query).reduce((acc, key) => {
    const value = query[key];
    acc[key] = typeof value === "string" ? value.trim() : value;
    return acc;
  }, {});
}

function readDateQuery(query = {}) {
  const queryData = sanitizeQuery(query);
  const isValid = validateRequiredDateQuery(queryData);

  if (!isValid) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message: "缺少必需的日期参数",
          errors: formatAjvErrors(validateRequiredDateQuery.errors)
        }
      }
    };
  }

  return { value: queryData };
}

function readCompleteHandoverBody(body = {}) {
  const isValid = validateCompleteHandover(body);

  if (!isValid) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message: "请求数据格式错误",
          errors: formatAjvErrors(validateCompleteHandover.errors)
        }
      }
    };
  }

  return { value: body };
}

module.exports = {
  PAYMENT_METHODS,
  completeHandoverSchema,
  formatAjvErrors,
  readCompleteHandoverBody,
  readDateQuery,
  requiredDateQuerySchema,
  sanitizeQuery,
  validateCompleteHandover,
  validateRequiredDateQuery
};
