"use strict";

const crypto = require('crypto');
const { URL } = require('url');
const { douyinConfig } = require('../../../appSettings/douyin.config');

function getClientSecret() {
  return process.env.DOUYIN_CLIENT_SECRET || douyinConfig.clientSecret || '';
}

function getClientKey() {
  return process.env.DOUYIN_CLIENT_KEY || douyinConfig.clientKey || '';
}

function timingSafeEqualText(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || '').trim().toLowerCase());
  const expectedBuffer = Buffer.from(String(expected || '').trim().toLowerCase());

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function getRawBody(req) {
  if (typeof req.rawBody === 'string') {
    return req.rawBody;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf8');
  }

  return '';
}

function removeLineBreaks(value) {
  return String(value || '').split(/\r?\n/).join('');
}

function computeWebhookSignature(rawBody, clientSecret = getClientSecret()) {
  const bodyForSign = removeLineBreaks(rawBody);
  return crypto
    .createHash('sha1')
    .update(clientSecret + bodyForSign)
    .digest('hex');
}

function verifyWebhookSignature(req) {
  const provided = req.get('X-Douyin-Signature') || '';
  const expected = computeWebhookSignature(getRawBody(req));
  return timingSafeEqualText(provided, expected);
}

function buildSpiSignString(req, clientSecret = getClientSecret()) {
  const rawUrl = req.originalUrl || req.url || '';
  const url = new URL(rawUrl, 'http://localhost');
  const query = url.searchParams;
  const keys = [];

  for (const [key] of query.entries()) {
    if (key.toLowerCase() === 'sign') {
      continue;
    }

    if (!keys.includes(key)) {
      keys.push(key);
    }
  }

  keys.sort();

  let result = clientSecret;
  for (const key of keys) {
    const values = query.getAll(key).sort();
    if (!values.length) {
      result += `&${key}=`;
      continue;
    }

    for (const value of values) {
      result += `&${key}=${value}`;
    }
  }

  result += `&http_body=${getRawBody(req)}`;
  return result;
}

function computeSpiSignature(req, clientSecret = getClientSecret()) {
  return crypto
    .createHash('sha256')
    .update(buildSpiSignString(req, clientSecret))
    .digest('hex')
    .toLowerCase();
}

function verifySpiClientKey(req) {
  const configuredClientKey = getClientKey();
  if (!configuredClientKey) {
    return true;
  }

  const headerClientKey = req.get('x-life-clientkey') || '';
  const queryClientKey = String(req.query?.client_key || '');
  const providedClientKey = queryClientKey || headerClientKey;

  return providedClientKey === configuredClientKey;
}

function verifySpiSignature(req) {
  const provided = req.get('x-life-sign') || '';
  const expected = computeSpiSignature(req);
  return timingSafeEqualText(provided, expected) && verifySpiClientKey(req);
}

module.exports = {
  computeWebhookSignature,
  verifyWebhookSignature,
  buildSpiSignString,
  computeSpiSignature,
  verifySpiSignature,
  getRawBody
};
