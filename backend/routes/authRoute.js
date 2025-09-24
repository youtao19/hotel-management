"use strict";
const express = require('express');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const router = express.Router();
const authentication = require("../modules/authentication");
const Ajv = require("ajv");
const ajv = new Ajv();
const addFormats = require("ajv-formats");
addFormats(ajv);
const db = require("../database/postgreDB/pg");
const account = require("../database/postgreDB/tables/account");
const redisDB = require("../database/redis/redis");
const util = require("util");
const setup = require("../appSettings/setup");
const emailJob = require("../modules/emailSetup");
const rateLimiter = require("../modules/rateLimiter");
const { getUsernameIPkey } = rateLimiter;


const signUpBodySchema = {
    type: "object",
    properties: {
        email: {
            type: "string",
            format: 'email'
        },
        name: {
            type: "string"
        },
        pw: {
            type: "string"
        }
    },
    required: ["email", "name", "pw"],
    additionalProperties: false
}
const validateSignup = ajv.compile(signUpBodySchema);

const loginBodySchema = {
    type: "object",
    properties: {
        email: {
            type: "string",
            format: 'email'
        },
        password: {
            type: "string"
        }
    },
    required: ["email", "password"],
    additionalProperties: false
}

const validateLogin = ajv.compile(loginBodySchema);

// 新的登录模式
const loginSchema = {
    type: "object",
    properties: {
        email: {
            type: "string",
            format: 'email'
        },
        password: {
            type: "string"
        }
    },
    required: ["email", "password"],
    additionalProperties: false
};

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
const validateResetPWEmail = ajv.compile(emailResetPWSchema);

const resetPWSchema = {
    type: "object",
    properties: {
        pw: {
            type: "string"
        },
        code: {
            type: "string"
        }
    },
    required: ["pw", "code"],
    additionalProperties: false
}
const validateResetPW = ajv.compile(resetPWSchema);

const emailVerifySchema = {
    type: "object",
    properties: {
        code: {
            type: "string"
        }
    },
    required: ["code"],
    additionalProperties: false
}
const validateEmailVerify = ajv.compile(emailVerifySchema);

router.post("/signup", async (req, res, next) => {
    try {
        const valid = validateSignup(req.body);
        if (!valid) {
            console.log(validateSignup.errors);
            console.log(req.body);
            return res.status(400).json({ message: "Invalid input data" });
        } else {
            //hash the pw
            const hash = await bcrypt.hash(req.body.pw, saltRounds);
            //store the account obj into database
            const insertOneQuery = {
                text: `INSERT INTO ${account.tableName}(name,email,pw,created_at,email_verified) VALUES($1,$2,$3,$4,$5) RETURNING *`,
                values: [req.body.name, req.body.email, hash, new Date(), false]
            };

            let a_resp = await db.query(insertOneQuery);
            if(a_resp.rows.length != 1){
                throw new Error("no account created!");
            } else {
                let {id,name,email} = a_resp.rows[0];
                return res.status(200).json({
                    id,
                    name,
                    email
                });
            }
        }
    } catch (e) {
        console.error(`some error occured ${e}`);
        // 检查是否是邮箱重复错误
        if (e.code === '23505' && e.constraint === 'account_email_key') {
            return res.status(409).json({ message: "该邮箱已被注册" });
        }
        return res.status(500).json({ message: "注册失败，请稍后重试" });
    }
});

router.post("/login", async (req, res) => {
    console.log("=== 登录请求开始 ===");
    console.log("请求体:", req.body);
    console.log("客户端IP:", req.ip);

    try {
        const { email, password } = req.body;
        console.log("提取的邮箱和密码:", { email, password: password ? "***隐藏***" : "undefined" });

        // 输入验证
        const validate = ajv.compile(loginSchema);
        if (!validate({ email, password })) {
            console.log("输入验证失败:", validate.errors);
            return res.status(400).json({
                message: "输入验证失败",
                errors: validate.errors
            });
        }
        console.log("输入验证通过");

        // 检查是否达到最大失败次数
        console.log("获取速率限制器...");
        const limiterSlowBruteByIP = rateLimiter.limiterSlowBruteByIP;
        const limiterConsecutiveFailsByUsernameAndIP = rateLimiter.limiterConsecutiveFailsByUsernameAndIP;
        console.log("速率限制器获取成功");

        const keyUsernameIP = `${email}_${req.ip}`;
        console.log("速率限制键:", keyUsernameIP);

        console.log("检查速率限制状态...");
        const [resUsernameAndIP, resSlowByIP] = await Promise.all([
            limiterConsecutiveFailsByUsernameAndIP.get(keyUsernameIP),
            limiterSlowBruteByIP.get(req.ip),
        ]);
        console.log("速率限制状态:", {
            usernameAndIP: resUsernameAndIP ? resUsernameAndIP.remainingPoints : "无限制",
            slowByIP: resSlowByIP ? resSlowByIP.remainingPoints : "无限制"
        });

        let retrySecs = 0;

        if (resSlowByIP !== null && resSlowByIP.remainingPoints <= 0) {
            retrySecs = Math.round(resSlowByIP.msBeforeNext / 1000) || 1;
        }

        if (resUsernameAndIP !== null && resUsernameAndIP.remainingPoints <= 0) {
            retrySecs = Math.round(resUsernameAndIP.msBeforeNext / 1000) || 1;
        }

        if (retrySecs > 0) {
            console.log("速率限制触发，重试秒数:", retrySecs);
            res.set('Retry-After', String(retrySecs));
            return res.status(429).json({
                message: `登录尝试次数过多，请${retrySecs}秒后重试`
            });
        }
        console.log("速率限制检查通过");

        // 查找用户
        console.log("查询用户:", email);
        const result = await db.query('SELECT * FROM account WHERE email = $1', [email]);
        const user = result.rows[0];
        console.log("用户查询结果:", user ? `找到用户ID: ${user.id}` : "未找到用户");

        if (!user) {
            console.log("用户不存在，记录失败尝试");
            // 记录失败尝试
            try {
                await limiterConsecutiveFailsByUsernameAndIP.consume(keyUsernameIP);
                await limiterSlowBruteByIP.consume(req.ip);
            } catch (rlRejected) {
                console.log("速率限制器拒绝（用户不存在）");
            }
            return res.status(401).json({ message: "邮箱或密码错误" });
        }

        // 验证密码
        console.log("验证密码...");
        const isPasswordValid = await bcrypt.compare(password, user.pw);
        console.log("密码验证结果:", isPasswordValid);

        if (!isPasswordValid) {
            console.log("密码错误，记录失败尝试");
            // 记录失败尝试
            try {
                await limiterConsecutiveFailsByUsernameAndIP.consume(keyUsernameIP);
                await limiterSlowBruteByIP.consume(req.ip);
            } catch (rlRejected) {
                console.log("速率限制器拒绝（密码错误）");
            }
            return res.status(401).json({ message: "邮箱或密码错误" });
        }

        // 登录成功，重置失败计数
        console.log("密码验证通过，重置失败计数");
        if (resUsernameAndIP !== null && resUsernameAndIP.totalHits > 0) {
            await limiterConsecutiveFailsByUsernameAndIP.delete(keyUsernameIP);
            console.log("失败计数已重置");
        }

        // 检查邮箱验证状态
        console.log("检查邮箱验证状态:", user.email_verified);
        if (!user.email_verified) {
            console.log("邮箱未验证");
            return res.status(403).json({
                message: "请先验证您的邮箱",
                code: "EMAIL_NOT_VERIFIED"
            });
        }

        // 设置会话
        console.log("设置会话...");
        console.log("当前session:", req.session);
        req.session.userId = user.id;
        req.session.email = user.email;
        console.log("会话设置后:", req.session);

        // 返回用户信息（不包括密码）
        const { pw: _, ...userWithoutPassword } = user;
        console.log("准备返回用户信息");

        res.json({
            message: "登录成功",
            user: userWithoutPassword
        });
        console.log("=== 登录请求成功结束 ===");

    } catch (error) {
        console.error("=== 登录错误 ===");
        console.error("错误信息:", error.message);
        console.error("错误堆栈:", error.stack);
        console.error("=== 登录错误结束 ===");
        res.status(500).json({ message: "登录失败，请稍后重试" });
    }

});

router.post("/send-email-verification", async (req, res, next) => {
    try {
        const valid = validateResetPWEmail(req.body);
        if (!valid) {
            console.log(validateResetPWEmail.errors);
            console.log(req.body);
            return res.status(400).json();
        } else {
            //check if email exists, otherwise we do not send email
            const checkEmailExistQuery = {
                text: `SELECT * FROM ${account.tableName} where email=$1`,
                values: [req.body.email]
            };
            const result = await db.query(checkEmailExistQuery);
            if (result.rows.length === 0) {
                //no match found
                console.log(`email not in our system. The user is trying to send req directly without using browser! api is sending email verificaiton`);
                return res.status(400).end();
            } else {
                //check if we have already sent one, if so, we do not send anymore in one hour.
                const redis = redisDB.getClient();
                // Initialize an empty array to store all values
                const values = [];
                // Initialize the cursor for the scan command
                let cursor = "0";
                // Continue scanning until the cursor is "0"
                do {
                    // Scan for keys matching the pattern "emailVerification*"
                    const [nextCursor, scannedKeys] = await redis.scan(cursor, "MATCH", "emailVerification*");
                    // Retrieve the values for each scanned key
                    if (scannedKeys.length > 0) {
                        const scannedValues = await redis.mget(...scannedKeys);
                        values.push(...scannedValues);
                    }
                    // Update the cursor for the next iteration
                    cursor = nextCursor;
                } while (cursor !== "0");
                //check if this email has already be set in redis
                if (values.indexOf(req.body.email) !== -1) {
                    console.log(`${req.body.email} is trying to verify email within 10 mins more than once.`);
                    return res.status(setup.errorCode.rate_limit).end();
                } else {
                    //generate email code and url path
                    const redis = redisDB.getClient();
                    const { nanoid } = await import('nanoid');
                    const code = nanoid();
                    await redis.set("emailVerification" + code, req.body.email, "EX", 600); //600 === 10mins
                    await emailJob.sendEmailVerification(code, req.body.email, "zh-Hans");
                    return res.status(200).json();
                }
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json();
    }
});

router.post("/email-verify", async (req, res) => {
    try {
        const valid = validateEmailVerify(req.body);
        if (!valid) {
            console.log(validateEmailVerify.errors);
            console.log(req.body);
            return res.status(400).json()
        } else {
            //check code to see if it is valid
            const { code } = req.body;
            const redis = redisDB.getClient();
            const email = await redis.get("emailVerification" + code);
            if (!email) {
                return res.status(setup.errorCode.CODE_INVALID).json();
            } else {
                //update email verify info
                const updateEmailVerifyQuery = {
                    text: `UPDATE ${account.tableName} SET email_verified=$1 WHERE email=$2`,
                    values: [true, email]
                };
                await db.query(updateEmailVerifyQuery);
                //remove url code in redis to make it invalid
                await redis.del("emailVerification" + code);

                // Automatically log the user in
                const userResult = await db.query('SELECT * FROM account WHERE email = $1', [email]);
                const user = userResult.rows[0];

                req.session.userId = user.id;
                req.session.email = user.email;

                const { pw: _, ...userWithoutPassword } = user;

                return res.status(200).json({ 
                    message: "Email verified successfully", 
                    user: userWithoutPassword 
                });
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json();
    }
});

router.get("/check/email/:email", async (req, res, next) => {
    try {
        const checkEmailQuery = {
            text: "SELECT email FROM account WHERE email=$1",
            values: [req.params.email]
        };
        const result = await db.query(checkEmailQuery);
        if (result.rows.length === 0) {
            //the user can use the email
            return res.status(200).json({
                "exist": false
            });
        } else {
            //email already exists
            return res.status(200).json({
                "exist": true
            });
        }
    } catch (e) {
        console.error(e);
        return res.status(500).json();
    }
});

router.post("/send-pwreset-email", async (req, res, next) => {
    try {
        const valid = validateResetPWEmail(req.body);
        if (!valid) {
            console.log(validateResetPWEmail.errors);
            console.log(req.body);
            return res.status(400).json();
        } else {
            //check if email exists, otherwise we do not send email
            const checkEmailExistQuery = {
                text: `SELECT * FROM ${account.tableName} where email=$1`,
                values: [req.body.email]
            };
            const result = await db.query(checkEmailExistQuery);
            if (result.rows.length === 0) {
                //no match found
                console.log(`email not in our system. The user is trying to send req directly without using browser!`);
                return res.status(400).json();
            } else {
                //check if we have already sent one, if so, we do not send anymore in one hour.
                const redis = redisDB.getClient();
                // Initialize an empty array to store all values
                const values = [];
                // Initialize the cursor for the scan command
                let cursor = "0";
                // Continue scanning until the cursor is "0"
                do {
                    // Scan for keys matching the pattern "resetPW*"
                    const [nextCursor, scannedKeys] = await redis.scan(cursor, "MATCH", "resetPassword*");
                    // Retrieve the values for each scanned key
                    if (scannedKeys.length > 0) {
                        const scannedValues = await redis.mget(...scannedKeys);
                        values.push(...scannedValues);
                    }
                    // Update the cursor for the next iteration
                    cursor = nextCursor;
                } while (cursor !== "0");
                //check if this email has already be set in redis
                if (values.indexOf(req.body.email) !== -1) {
                    console.log(`${req.body.email} is trying to send reset pw email within 1 hour more than once.`);
                    return res.status(setup.errorCode.rate_limit).json();
                } else {
                    const { nanoid } = await import('nanoid');
                    const code = nanoid();
                    await redis.set("resetPassword" + code, req.body.email, "EX", 3600); //3600 === 1hr
                    await emailJob.sendResetPWEmail(code, req.body.email, setup.lang['zh-Hans']);
                    return res.status(200).json();
                }
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json();
    }
});

router.post("/reset-pw", async (req, res, next) => {
    try {
        const valid = validateResetPW(req.body);
        if (!valid) {
            console.log(validateResetPW.errors);
            console.log(req.body);
            return res.status(400).json()
        } else {
            //check code to see if it is valid
            const { pw, code } = req.body;
            const redis = redisDB.getClient();
            const email = await redis.get("resetPassword" + code);
            if (!email) {
                return res.status(setup.errorCode.CODE_INVALID).json();
            } else {
                //hash the new pw
                const hash = await bcrypt.hash(pw, saltRounds);
                //reset password for that email
                const updatePWQuery = {
                    text: `UPDATE ${account.tableName} SET pw=$1 WHERE email=$2`,
                    values: [hash, email]
                };
                const result = await db.query(updatePWQuery);
                //remove url code in redis to make it invalid
                await redis.del("resetPassword" + code);
                return res.status(200).json();
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json();
    }
});

router.get("/check/reset-code/:code", async (req, res, next) => {
    try {
        const code = req.params.code;
        const redis = redisDB.getClient();
        const email = await redis.get("resetPassword" + code);
        if (email) {
            return res.status(200).json({
                "exist": true
            });
        } else {
            return res.status(200).json({
                "exist": false
            })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json();
    }
});

// 测试路由
router.post("/test-login", (req, res) => {
    console.log("测试路由被调用");
    console.log("请求体:", req.body);
    res.json({ message: "测试成功", body: req.body });
});

// 调试登录路由
router.post("/debug-login", async (req, res) => {
    console.log("=== 调试登录开始 ===");
    try {
        const { email, password } = req.body;
        console.log("1. 提取数据:", { email, password: password ? "***" : "undefined" });

        // 测试输入验证
        const validate = ajv.compile(loginSchema);
        const isValid = validate({ email, password });
        console.log("2. 输入验证:", isValid, validate.errors);

        if (!isValid) {
            return res.status(400).json({ message: "输入验证失败", errors: validate.errors });
        }

        // 测试数据库查询
        console.log("3. 开始数据库查询");
        const result = await db.query('SELECT * FROM account WHERE email = $1', [email]);
        console.log("4. 数据库查询结果行数:", result.rows.length);

        const user = result.rows[0];
        if (!user) {
            console.log("5. 用户不存在");
            return res.status(401).json({ message: "用户不存在" });
        }

        console.log("6. 找到用户:", user.id, user.email);
        console.log("6.1. 用户对象完整结构:", JSON.stringify(user, null, 2));
        console.log("6.2. 用户密码字段pw:", typeof user.pw, user.pw ? "存在" : "不存在");
        console.log("6.3. 用户密码字段password:", typeof user.password, user.password ? "存在" : "不存在");

        // 测试密码验证
        console.log("7. 开始密码验证");
        if (!user.pw) {
            return res.status(500).json({ message: "用户密码字段为空" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.pw);
        console.log("8. 密码验证结果:", isPasswordValid);

        if (!isPasswordValid) {
            // 让我们测试一些常见密码
            console.log("8.1. 开始测试常见密码");
            const testPasswords = ["123456", "password", "test123"];
            for (const testPw of testPasswords) {
                const testResult = await bcrypt.compare(testPw, user.pw);
                console.log(`测试密码 ${testPw}:`, testResult);
                if (testResult) {
                    return res.json({ message: "找到匹配密码", correctPassword: testPw, userId: user.id });
                }
            }
            console.log("8.2. 没有找到匹配的密码");
            return res.status(401).json({ message: "密码错误" });
        }

        console.log("9. 密码验证通过");
        return res.json({ message: "调试成功", userId: user.id, email: user.email });

    } catch (error) {
        console.error("调试错误:", error.message);
        console.error("错误堆栈:", error.stack);
        return res.status(500).json({ message: "调试失败", error: error.message });
    }
});

module.exports = router;
