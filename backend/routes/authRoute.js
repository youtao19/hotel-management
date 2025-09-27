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
const { limiterSlowBruteByIP, limiterConsecutiveFailsByUsernameAndIP, getUsernameIPkey } = require("../modules/rateLimiter");
const {nanoid} = require("nanoid");

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
        pw: {
            type: "string"
        }
    },
    required: ["email", "pw"],
    additionalProperties: false
}

const validateLogin = ajv.compile(loginBodySchema);

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
            return res.status(400).json();
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
        return res.status(500).json()
    }
});

router.post("/login", async (req, res) => {
    try {
        const valid = validateLogin(req.body);
        if (!valid) {
            console.log(validateLogin.errors);
            console.log(req.body);
            return res.status(400).json();
        } else {
            //login rate limiter has two pass
            //user ip pair for max 6 failure
            //ip for max 15 failure
            const ipAddr = req.ip;
            const usernameIPkey = getUsernameIPkey(req.body.email, ipAddr);

            const [resUsernameAndIP, resSlowByIP] = await Promise.all([
                limiterConsecutiveFailsByUsernameAndIP.get(usernameIPkey),// 用户+ip的限流
                limiterSlowBruteByIP.get(ipAddr),// ip的限流
            ]);

            let retrySecs = 0;

            // Check if IP or Username + IP is already blocked
            if (resSlowByIP !== null && resSlowByIP.consumedPoints > setup.maxWrongAttemptsByIPperDay) { // ip的限流
                retrySecs = Math.round(resSlowByIP.msBeforeNext / 1000) || 1; // 返回限流时间
            } else if (resUsernameAndIP !== null && resUsernameAndIP.consumedPoints > setup.maxConsecutiveFailsByUsernameAndIP) { // 用户+ip的限流
                retrySecs = Math.round(resUsernameAndIP.msBeforeNext / 1000) || 1; // 返回限流时间
            }

            // 如果限流时间大于0，则返回限流错误
            if (retrySecs > 0) {
                res.set('Retry-After', String(retrySecs));
                return res.status(setup.errorCode.rate_limit).send('Too Many Requests');
            } else {
                // 如果限流时间小于0，则查询数据库
                const getPWQuery = {
                    text: `SELECT * FROM ${account.tableName} where email=$1`,
                    values: [req.body.email]
                }

                const result = await db.query(getPWQuery);
                if (result.rows.length === 0) {
                    //no match found
                    try {
                        const promises = [limiterSlowBruteByIP.consume(ipAddr)];
                        await Promise.all(promises);
                        return res.status(setup.errorCode.NO_Match).json();
                    } catch (rlRejected) {
                        if (rlRejected instanceof Error) {
                            throw rlRejected;
                        } else {
                            res.set('Retry-After', String(Math.round(rlRejected.msBeforeNext / 1000)) || 1);
                            return res.status(setup.errorCode.rate_limit).send('Too Many Requests');
                        }
                    }
                } else {
                    //we found a match using email
                    //match found and we check pw
                    const match = await bcrypt.compare(req.body.pw, result.rows[0].pw);
                    if (match) {
                        // 检查邮箱是否已验证
                        if (!result.rows[0].email_verified) {
                            // 邮箱未验证，返回特定错误码
                            try {
                                // 仍然计算失败尝试次数，防止通过未验证邮箱绕过限流
                                const promises = [limiterSlowBruteByIP.consume(ipAddr), limiterConsecutiveFailsByUsernameAndIP.consume(usernameIPkey)];
                                await Promise.all(promises);
                                return res.status(setup.errorCode.email_not_verified).json();
                            } catch (rlRejected) {
                                if (rlRejected instanceof Error) {
                                    throw rlRejected;
                                } else {
                                    res.set('Retry-After', String(Math.round(rlRejected.msBeforeNext / 1000)) || 1);
                                    return res.status(setup.errorCode.rate_limit).send('Too Many Requests');
                                }
                            }
                        }

                        //log the user in
                        const { id, name, email } = result.rows[0];
                        const params = {
                            account: {
                                id,
                                name,
                                email
                            }
                        };
                        await req.login(params);
                        // Reset rate limiter on successful authorisation
                        if (resUsernameAndIP !== null && resUsernameAndIP.consumedPoints > 0) {
                            await limiterConsecutiveFailsByUsernameAndIP.delete(usernameIPkey);
                        } else if (resSlowByIP !== null && resSlowByIP.consumedPoints > 0) {
                            await limiterSlowBruteByIP.delete(ipAddr);
                        }

                        return res.status(200).json(params.account);
                    } else {
                        //pw not correct
                        try {
                            // Count failed attempts by Username + IP only for registered users
                            const promises = [limiterSlowBruteByIP.consume(ipAddr), limiterConsecutiveFailsByUsernameAndIP.consume(usernameIPkey)];
                            await Promise.all(promises);
                            return res.status(setup.errorCode.PW_INCORRECT).json();
                        } catch (rlRejected) {
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
        console.error("some error occured in login",e);
        return res.status(500).json()
    }

});

// 向新注册用户发送验证邮件
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
                return res.status(200).json();
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
                    //generate pw reset code and url path
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


module.exports = router;
