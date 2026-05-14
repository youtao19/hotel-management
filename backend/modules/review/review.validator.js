"use strict";

const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const ajv = new Ajv();
addFormats(ajv);

const positiveReviewSchema = {
  type: "object",
  properties: {
    positive_review: { type: "boolean" }
  },
  required: ["positive_review"],
  additionalProperties: false
};

const validatePositiveReview = ajv.compile(positiveReviewSchema);

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
  formatAjvErrors,
  positiveReviewSchema,
  validatePositiveReview
};
