"use strict";

const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const ajv = new Ajv();
addFormats(ajv);

const signupSchema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
    name: { type: "string" },
    pw: { type: "string" }
  },
  required: ["email", "name", "pw"],
  additionalProperties: false
};

const loginSchema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
    pw: { type: "string" }
  },
  required: ["email", "pw"],
  additionalProperties: false
};

const emailSchema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" }
  },
  required: ["email"],
  additionalProperties: false
};

const resetPasswordSchema = {
  type: "object",
  properties: {
    pw: { type: "string" },
    code: { type: "string" }
  },
  required: ["pw", "code"],
  additionalProperties: false
};

const codeSchema = {
  type: "object",
  properties: {
    code: { type: "string" }
  },
  required: ["code"],
  additionalProperties: false
};

const validateSignup = ajv.compile(signupSchema);
const validateLogin = ajv.compile(loginSchema);
const validateEmail = ajv.compile(emailSchema);
const validateResetPassword = ajv.compile(resetPasswordSchema);
const validateCode = ajv.compile(codeSchema);

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

module.exports = {
  codeSchema,
  emailSchema,
  formatAjvErrors,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  validateCode,
  validateEmail,
  validateLogin,
  validateResetPassword,
  validateSignup
};
