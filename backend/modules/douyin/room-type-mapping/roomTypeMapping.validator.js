const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const syncOptionsSchema = {
  type: 'object',
  properties: {
    accountId: { type: 'string', minLength: 1, maxLength: 64 },
    poiId: { type: 'string', minLength: 1, maxLength: 64 }
  },
  additionalProperties: false
};

const saveMappingsSchema = {
  type: 'object',
  properties: {
    mappings: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          localRoomType: { type: 'string', minLength: 1, maxLength: 255 },
          douyinRoomId: { type: 'string', minLength: 1, maxLength: 64 }
        },
        required: ['localRoomType', 'douyinRoomId'],
        additionalProperties: false
      }
    }
  },
  required: ['mappings'],
  additionalProperties: false
};

const validateSyncOptions = ajv.compile(syncOptionsSchema);
const validateSaveMappings = ajv.compile(saveMappingsSchema);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeOptions(payload = {}) {
  return {
    accountId: normalizeString(payload.accountId),
    poiId: normalizeString(payload.poiId)
  };
}

function normalizeMappings(payload = {}) {
  return {
    mappings: Array.isArray(payload.mappings)
      ? payload.mappings.map((item) => ({
        localRoomType: normalizeString(item.localRoomType),
        douyinRoomId: normalizeString(item.douyinRoomId)
      }))
      : payload.mappings
  };
}

function getValidationMessage(errors) {
  return (errors || [])
    .map((error) => `${error.instancePath || error.schemaPath} ${error.message}`)
    .join('; ');
}

module.exports = {
  getValidationMessage,
  normalizeMappings,
  normalizeOptions,
  normalizeString,
  validateSaveMappings,
  validateSyncOptions
};
