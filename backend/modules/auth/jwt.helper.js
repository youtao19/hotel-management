"use strict";

const jwt = require("jsonwebtoken");
const setup = require("../../appSettings/setup");

/**
 * 签发员工登录态 JWT。
 * 载荷只放最小账号信息，避免泄露或与数据库口径不一致。
 * @param {{id:number,name:string,email:string}} account 登录账号
 * @returns {string} 签名后的 JWT
 */
function signAccountToken(account) {
  return jwt.sign(
    { id: account.id, name: account.name, email: account.email },
    setup.jwtSecret,
    { algorithm: "HS256", expiresIn: setup.jwtExpiresIn }
  );
}

/**
 * 校验 Bearer token，返回解码后的账号信息。
 * 校验失败时抛出 jsonwebtoken 的具体错误，由调用方区分 401 语义。
 * @param {string} token Bearer token 字符串
 * @returns {{id:number,name:string,email:string}} 解码后的账号信息
 */
function verifyAccountToken(token) {
  const decoded = jwt.verify(token, setup.jwtSecret, { algorithms: ["HS256"] });
  if (!decoded || !decoded.id) {
    const error = new Error("invalid token payload");
    error.name = "TokenPayloadError";
    throw error;
  }
  return { id: decoded.id, name: decoded.name, email: decoded.email };
}

module.exports = {
  signAccountToken,
  verifyAccountToken
};
