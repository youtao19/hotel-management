"use strict";
const express = require('express'); // 引入 Express 框架
const bcrypt = require('bcrypt'); // 引入 bcrypt 用于密码哈希
const saltRounds = 10; // bcrypt 加盐轮数
const router = express.Router(); // 创建 Express 路由实例
const authentication = require("../modules/authentication"); // 引入自定义认证模块
const Ajv = require("ajv"); // 引入 Ajv 用于 JSON Schema 验证
const ajv = new Ajv();
const addFormats = require("ajv-formats"); // 引入 Ajv 格式插件
addFormats(ajv);
const db = require("../database/postgreDB/pg"); // 引入 PostgreSQL 数据库模块
const account = require("../database/postgreDB/tables/account"); // 引入 account 表定义
const redisDB = require("../database/redis/redis"); // 引入 Redis 数据库模块
const util = require("util"); // 引入 Node.js 工具模块
const setup = require("../../appSettings/setup"); // 引入应用设置
const emailJob = require("../modules/emailSetup"); // 引入邮件发送模块
const { limiterSlowBruteByIP, limiterConsecutiveFailsByUsernameAndIP, getUsernameIPkey } = require("../modules/rateLimiter"); // 引入速率限制器模块
const nanoid = require("nanoid"); // 引入 nanoid 用于生成唯一 ID

// 注册请求体 JSON Schema
const signUpBodySchema = {
    type: "object",
    properties: {
        email: {
            type: "string",
            format: 'email' // 必须是 email 格式
        },
        name: {
            type: "string"
        },
        pw: {
            type: "string"
        }
    },
    required: ["email", "name", "pw"], // 必填字段
    additionalProperties: false // 不允许额外属性
}
const validateSignup = ajv.compile(signUpBodySchema); // 编译注册验证函数

// 登录请求体 JSON Schema
const loginBodySchema = {
    type: "object",
    properties: {
        email: {
            type: "string",
            format: 'email'
        },
        pw: {
            type: "string"
        }
    },
    required: ["email", "pw"],
    additionalProperties: false
}
const validateLogin = ajv.compile(loginBodySchema); // 编译登录验证函数

// 请求重设密码邮件的请求体 JSON Schema
const emailResetPWSchema = {
    type: "object",
    properties: {
        email: {
            type: "string",
            format: 'email'
        }
    },
    required: ["email"],
    additionalProperties: false
}
const validateResetPWEmail = ajv.compile(emailResetPWSchema); // 编译请求重设密码邮件验证函数

// 重设密码请求体 JSON Schema
const resetPWSchema = {
    type: "object",
    properties: {
        pw: {
            type: "string"
        },
        code: { // 重设密码的验证码
            type: "string"
        }
    },
    required: ["pw", "code"],
    additionalProperties: false
}
const validateResetPW = ajv.compile(resetPWSchema); // 编译重设密码验证函数

// 邮箱验证请求体 JSON Schema
const emailVerifySchema = {
    type: "object",
    properties: {
        code: { // 邮箱验证码
            type: "string"
        }
    },
    required: ["code"],
    additionalProperties: false
}
const validateEmailVerify = ajv.compile(emailVerifySchema); // 编译邮箱验证函数

// POST /signup - 用户注册路由
router.post("/signup", async (req, res, next) => {
    try {
        const valid = validateSignup(req.body); // 验证请求体
        if (!valid) {
            console.log(validateSignup.errors); // 打印验证错误
            console.log(req.body);
            return res.status(400).json(); // 返回 400 Bad Request
        } else {
            // 哈希密码
            const hash = await bcrypt.hash(req.body.pw, saltRounds);
            // 将账户信息存入数据库
            const insertOneQuery = {
                text: `INSERT INTO ${account.tableName}(name,email,pw,created_at,email_verified) VALUES($1,$2,$3,$4,$5) RETURNING *`,
                values: [req.body.name, req.body.email, hash, new Date(), false] // 初始 email_verified 为 false
            };

            let a_resp = await db.query(insertOneQuery); // 执行数据库插入操作
            if(a_resp.rows.length != 1){
                throw new Error("创建账户失败！");
            } else {
                let {id,name,email} = a_resp.rows[0]; // 获取新创建账户的信息
                return res.status(200).json({ // 返回成功信息和部分用户信息
                    id,
                    name,
                    email
                });
            }            
        }
    } catch (e) {
        console.error(`注册时发生错误: ${e}`);
        return res.status(500).json()
    }
});

// POST /login - 用户登录路由
router.post("/login", async (req, res) => {
    try {
        const valid = validateLogin(req.body); // 验证请求体
        if (!valid) {
            console.log(validateLogin.errors);
            console.log(req.body);
            return res.status(400).json();
        } else {
            // 登录速率限制：
            // 1. 基于 用户名+IP 的连续失败次数限制
            // 2. 基于 IP 的总失败次数限制
            const ipAddr = req.ip; // 获取请求 IP 地址
            const usernameIPkey = getUsernameIPkey(req.body.email, ipAddr); // 生成 用户名+IP 的键

            // 并发获取两个限制器的状态
            const [resUsernameAndIP, resSlowByIP] = await Promise.all([
                limiterConsecutiveFailsByUsernameAndIP.get(usernameIPkey),
                limiterSlowBruteByIP.get(ipAddr),
            ]);

            let retrySecs = 0; // 需要等待的秒数

            // 检查是否已被阻止
            if (resSlowByIP !== null && resSlowByIP.consumedPoints > setup.maxWrongAttemptsByIPperDay) {
                // IP 失败次数过多
                retrySecs = Math.round(resSlowByIP.msBeforeNext / 1000) || 1;
            } else if (resUsernameAndIP !== null && resUsernameAndIP.consumedPoints > setup.maxConsecutiveFailsByUsernameAndIP) {
                // 用户名+IP 连续失败次数过多
                retrySecs = Math.round(resUsernameAndIP.msBeforeNext / 1000) || 1;
            }

            if (retrySecs > 0) {
                // 如果需要等待，设置 Retry-After 响应头并返回 429 Too Many Requests
                res.set('Retry-After', String(retrySecs));
                return res.status(setup.errorCode.rate_limit).send('Too Many Requests');
            } else {
                // 查询数据库中是否存在该邮箱
                const getPWQuery = {
                    text: `SELECT * FROM ${account.tableName} where email=$1`,
                    values: [req.body.email]
                }

                const result = await db.query(getPWQuery);
                if (result.rows.length === 0) {
                    // 邮箱不存在
                    try {
                        // 消耗 IP 限制器的点数 (防止探测用户是否存在)
                        const promises = [limiterSlowBruteByIP.consume(ipAddr)];
                        await Promise.all(promises);
                        return res.status(setup.errorCode.NO_Match).json();
                    } catch (rlRejected) {
                        // 处理速率限制错误
                        if (rlRejected instanceof Error) {
                            throw rlRejected;
                        } else {
                            res.set('Retry-After', String(Math.round(rlRejected.msBeforeNext / 1000)) || 1);
                            return res.status(setup.errorCode.rate_limit).send('Too Many Requests');
                        }
                    }
                } else {
                    // 邮箱存在，验证密码
                    const match = await bcrypt.compare(req.body.pw, result.rows[0].pw); // 比较哈希密码
                    if (match) {
                        // 密码正确
                        const { id, name, email } = result.rows[0];
                        const params = {
                            account: {
                                id,
                                name,
                                email
                            }
                        };
                        await req.login(params); // 使用认证模块创建会话

                        // 登录成功后重置相关速率限制器的计数
                        if (resUsernameAndIP !== null && resUsernameAndIP.consumedPoints > 0) {
                            await limiterConsecutiveFailsByUsernameAndIP.delete(usernameIPkey);
                        } else if (resSlowByIP !== null && resSlowByIP.consumedPoints > 0) {
                            await limiterSlowBruteByIP.delete(ipAddr);
                        }

                        return res.status(200).json(params.account); // 返回用户信息
                    } else {
                        // 密码错误
                        try {
                            // 消耗 IP 和 用户名+IP 限制器的点数
                            const promises = [limiterSlowBruteByIP.consume(ipAddr), limiterConsecutiveFailsByUsernameAndIP.consume(usernameIPkey)];
                            await Promise.all(promises);
                            return res.status(setup.errorCode.PW_INCORRECT).json();
                        } catch (rlRejected) {
                            // 处理速率限制错误
                            if (rlRejected instanceof Error) {
                                throw rlRejected;
                            } else {
                                res.set('Retry-After', String(Math.round(rlRejected.msBeforeNext / 1000)) || 1);
                                return res.status(setup.errorCode.rate_limit).send('Too Many Requests');
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error(`登录时发生错误: ${e}`);
        return res.status(500).json()
    }

});

// POST /send-email-verification - 发送邮箱验证邮件路由
router.post("/send-email-verification", async (req, res, next) => {
    try {
        // 验证请求体 (只需要 email)
        const valid = validateResetPWEmail(req.body); // 复用验证 email 的 schema
        if (!valid) {
            console.log(validateResetPWEmail.errors);
            console.log(req.body);
            return res.status(400).json();
        } else {
            // 检查邮箱是否存在于数据库中
            const checkEmailExistQuery = {
                text: `SELECT * FROM ${account.tableName} where email=$1`,
                values: [req.body.email]
            };
            const result = await db.query(checkEmailExistQuery);
            if (result.rows.length === 0) {
                // 邮箱不存在，不应发送验证邮件
                console.log(`邮箱 ${req.body.email} 不存在，无法发送验证邮件。`);
                return res.status(400).end();
            } else {
                // 检查 Redis 中是否已存在该邮箱的验证码 (防止短时间内重复发送)
                const redis = redisDB.getClient();
                // 初始化一个空数组以存储所有值
                const values = [];
                // 初始化游标以用于扫描命令
                let cursor = "0";
                // 继续扫描直到游标为 "0"
                do {
                    // 扫描匹配模式 "emailVerification*" 的键
                    const [nextCursor, scannedKeys] = await redis.scan(cursor, "MATCH", "emailVerification*");
                    // 检索每个扫描键的值
                    if (scannedKeys.length > 0) {
                        const scannedValues = await redis.mget(...scannedKeys);
                        values.push(...scannedValues);
                    }
                    // 更新游标以用于下一次迭代
                    cursor = nextCursor;
                } while (cursor !== "0");
                // 检查此邮箱是否已在 Redis 中设置
                if (values.indexOf(req.body.email) !== -1) {
                    console.log(`${req.body.email} 在 10 分钟内尝试多次发送验证邮件。`);
                    return res.status(setup.errorCode.rate_limit).end();
                } else {
                    // 生成验证码并存入 Redis，有效期 10 分钟
                    const redis = redisDB.getClient();
                    const code = nanoid();
                    await redis.set("emailVerification" + code, req.body.email, "EX", 600); // key 加上前缀，方便管理
                    // 发送验证邮件
                    await emailJob.sendEmailVerification(code, req.body.email, "zh-Hans"); // 假设默认发送中文邮件
                    return res.status(200).json();
                }
            }
        }
    } catch (e) {
        console.error(`发送邮箱验证邮件时发生错误: ${e}`);
        return res.status(500).json();
    }
});

// POST /email-verify - 验证邮箱路由
router.post("/email-verify", async (req, res) => {
    try {
        const valid = validateEmailVerify(req.body); // 验证请求体 (只需要 code)
        if (!valid) {
            console.log(validateEmailVerify.errors);
            console.log(req.body);
            return res.status(400).json()
        } else {
            // 检查验证码是否存在于 Redis 中
            const { code } = req.body;
            const redis = redisDB.getClient();
            const email = await redis.get("emailVerification" + code); // 获取验证码对应的邮箱

            if (!email) {
                // 验证码无效或已过期
                return res.status(setup.errorCode.CODE_INVALID).json();
            } else {
                // 验证码有效，更新数据库中对应邮箱的验证状态
                const updateEmailVerifyQuery = {
                    text: `UPDATE ${account.tableName} SET email_verified=$1 WHERE email=$2`,
                    values: [true, email]
                };
                await db.query(updateEmailVerifyQuery);
                // 从 Redis 中删除已使用的验证码
                await redis.del("emailVerification" + code);
                return res.status(200).json();
            }
        }
    } catch (e) {
        console.error(`验证邮箱时发生错误: ${e}`);
        return res.status(500).json();
    }
});

// GET /check/email/:email - 检查邮箱是否已注册路由
router.get("/check/email/:email", async (req, res, next) => {
    try {
        const checkEmailQuery = {
            text: "SELECT email FROM account WHERE email=$1",
            values: [req.params.email]
        };
        const result = await db.query(checkEmailQuery);
        if (result.rows.length === 0) {
            // 邮箱未被注册
            return res.status(200).json({
                "exist": false
            });
        } else {
            // 邮箱已被注册
            return res.status(200).json({
                "exist": true
            });
        }
    } catch (e) {
        console.error(`检查邮箱存在性时发生错误: ${e}`);
        return res.status(500).json();
    }
});

// POST /send-pwreset-email - 发送重设密码邮件路由
router.post("/send-pwreset-email", async (req, res, next) => {
    try {
        const valid = validateResetPWEmail(req.body); // 验证请求体 (只需要 email)
        if (!valid) {
            console.log(validateResetPWEmail.errors);
            console.log(req.body);
            return res.status(400).json();
        } else {
            // 检查邮箱是否存在
            const checkEmailExistQuery = {
                text: `SELECT * FROM ${account.tableName} where email=$1`,
                values: [req.body.email]
            };
            const result = await db.query(checkEmailExistQuery);
            if (result.rows.length === 0) {
                // 邮箱不存在，为安全起见，不明确提示用户邮箱不存在，但记录日志
                console.log(`尝试为不存在的邮箱 ${req.body.email} 发送重设密码邮件。`);
                return res.status(400).json();
            } else {
                // 检查 Redis 中是否已存在该邮箱的重设密码请求 (防止短时间内重复发送)
                const redis = redisDB.getClient();
                // 初始化一个空数组以存储所有值
                const values = [];
                // 初始化游标以用于扫描命令
                let cursor = "0";
                // 继续扫描直到游标为 "0"
                do {
                    // 扫描匹配模式 "resetPW*" 的键
                    const [nextCursor, scannedKeys] = await redis.scan(cursor, "MATCH", "resetPassword*");
                    // 检索每个扫描键的值
                    if (scannedKeys.length > 0) {
                        const scannedValues = await redis.mget(...scannedKeys);
                        values.push(...scannedValues);
                    }
                    // 更新游标以用于下一次迭代
                    cursor = nextCursor;
                } while (cursor !== "0");
                // 检查此邮箱是否已在 Redis 中设置
                if (values.indexOf(req.body.email) !== -1) {
                    console.log(`${req.body.email} 在 1 小时内尝试多次发送重设密码邮件。`);
                    return res.status(setup.errorCode.rate_limit).json();
                } else {
                    // 生成重设密码验证码并存入 Redis，有效期 1 小时
                    const code = nanoid();
                    await redis.set("resetPassword" + code, req.body.email, "EX", 3600); // key 加上前缀
                    // 发送重设密码邮件
                    await emailJob.sendResetPWEmail(code, req.body.email, setup.lang['zh-Hans']); // 假设默认发送中文
                    return res.status(200).json();
                }
            }
        }
    } catch (e) {
        console.error(`发送重设密码邮件时发生错误: ${e}`);
        return res.status(500).json();
    }
});

// POST /reset-pw - 重设密码路由
router.post("/reset-pw", async (req, res, next) => {
    try {
        const valid = validateResetPW(req.body); // 验证请求体 (需要 pw 和 code)
        if (!valid) {
            console.log(validateResetPW.errors);
            console.log(req.body);
            return res.status(400).json()
        } else {
            // 检查重设密码验证码是否存在于 Redis 中
            const { pw, code } = req.body;
            const redis = redisDB.getClient();
            const email = await redis.get("resetPassword" + code); // 获取验证码对应的邮箱

            if (!email) {
                // 验证码无效或已过期
                return res.status(setup.errorCode.CODE_INVALID).json();
            } else {
                // 验证码有效，哈希新密码
                const hash = await bcrypt.hash(pw, saltRounds);
                // 更新数据库中对应邮箱的密码
                const updatePWQuery = {
                    text: `UPDATE ${account.tableName} SET pw=$1 WHERE email=$2`,
                    values: [hash, email]
                };
                const result = await db.query(updatePWQuery);
                // 从 Redis 中删除已使用的重设密码验证码
                await redis.del("resetPassword" + code);
                return res.status(200).json();
            }
        }
    } catch (e) {
        console.error(`重设密码时发生错误: ${e}`);
        return res.status(500).json();
    }
});

// GET /check/reset-code/:code - 检查重设密码验证码是否有效路由
router.get("/check/reset-code/:code", async (req, res, next) => {
    try {
        const code = req.params.code;
        const redis = redisDB.getClient();
        const email = await redis.get("resetPassword" + code); // 检查验证码是否存在
        if (email) {
            // 验证码有效
            return res.status(200).json({
                "exist": true
            });
        } else {
            // 验证码无效或已过期
            return res.status(200).json({
                "exist": false
            })
        }
    } catch (e) {
        console.error(`检查重设密码验证码时发生错误: ${e}`);
        return res.status(500).json();
    }
});


module.exports = router; // 导出路由