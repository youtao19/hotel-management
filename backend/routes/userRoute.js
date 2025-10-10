"use strict";
const express = require('express');
const util = require('node:util');
const db = require("../database/postgreDB/pg");
const account = require("../database/postgreDB/tables/account");
const Ajv = require("ajv");
const ajv = new Ajv();
const addFormats = require("ajv-formats");
addFormats(ajv);
const emailSetup = require("../modules/emailSetup");
const router = express.Router();
const authentication = require("../modules/authentication");
const setup = require("../appSettings/setup"); // ✅ 添加这行

// 登出路由不需要认证检查，放在认证中间件之前
router.get("/logout", async (req, res, next) => {
    try {
        // 即使 session 不存在，也清除 cookie
        const cookieName = setup.appName + ".sid";

        if (req.session && req.logout) {
            await req.logout();
        } else if (req.session) {
            // 手动清理 session
            await new Promise((resolve, reject) => {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Session destroy 失败:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        // 清除 cookie（重要！）
        res.clearCookie(cookieName, {
            path: '/',
            httpOnly: true,
            sameSite: setup.env === "production" ? "none" : "lax",
            secure: setup.env === "production"
        });

        return res.status(200).json({ message: '登出成功' });
    } catch (e) {
        console.error('登出操作失败:', e);

        // 即使失败也清除 cookie
        const cookieName = setup.appName + ".sid";
        res.clearCookie(cookieName, {
            path: '/',
            httpOnly: true,
            sameSite: setup.env === "production" ? "none" : "lax",
            secure: setup.env === "production"
        });

        return res.status(200).json({ message: '登出完成' });
    }
});

// 其他路由需要认证
router.use(authentication.ensureAuthenticated);

router.get("/info", async (req, res) => {
  try {
    // 1. 检查是否已登录
    if (!req.session.account || !req.session.account.id) {
      return res.status(401).json({ message: "未登录" })
    }

    // 2. 查询数据库
    const getAccountQuery = {
      text: `SELECT id, name, email, email_verified
             FROM ${account.tableName}
             WHERE id = $1`,
      values: [req.session.account.id]
    }
    const result = await db.query(getAccountQuery)

    // 3. 没找到用户
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "用户不存在" })
    }

    // 4. 返回用户数据
    return res.status(200).json(result.rows[0])
  } catch (e) {
    console.error(`/info route failed:`, e)
    return res.status(500).json({ message: "服务器内部错误" })
  }
})

router.get("/check/email", async (req, res) => {
    try {
        const getEmailVerified = {
            text: `SELECT email_verified FROM ${account.tableName} WHERE id = $1`,
            values: [req.session.account.id]
        };
        const result = await db.query(getEmailVerified);
        return res.status(200).json(result.rows[0]);
    } catch (e) {
        console.log(`/check/email route failed with error ${e}`);
        return res.status(500).json();
    }
});

const feedbackSchema = {
    type: "object",
    properties: {
        feedbackDetail: {
            type: "string",
            maxLength: 2000
        },
        reasons: {
            type: "array",
            items: {
                type: "string",
                maxLength: 200
            }
        },
        email: {
            type: "string",
            format: 'email'
        }
    },
    required: ["email", "reasons", "feedbackDetail"],
    additionalProperties: false
}
const validateFeedback = ajv.compile(feedbackSchema);

module.exports = router;
