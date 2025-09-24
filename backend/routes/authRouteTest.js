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
const setup = require("../appSettings/setup");

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

// 简化的注册接口（用于测试）
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

// 简化的登录接口（跳过限流检查，用于测试）
router.post("/login", async (req, res) => {
    try {
        const valid = validateLogin(req.body);
        if (!valid) {
            console.log(validateLogin.errors);
            console.log(req.body);
            return res.status(400).json({ message: "Invalid input data" });
        } else {
            const getPWQuery = {
                text: `SELECT * FROM ${account.tableName} where email=$1`,
                values: [req.body.email]
            }

            const result = await db.query(getPWQuery);
            if (result.rows.length === 0) {
                //no match found
                return res.status(setup.errorCode.NO_Match).json({ message: "用户名或密码错误" });
            } else {
                //we found a match using email
                //match found and we check pw
                const match = await bcrypt.compare(req.body.pw, result.rows[0].pw);
                if (match) {
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
                    return res.status(200).json(params.account);
                } else {
                    //pw not correct
                    return res.status(setup.errorCode.PW_INCORRECT).json({ message: "用户名或密码错误" });
                }
            }
        }
    } catch (e) {
        console.error(`some error occured ${e} in login`);
        return res.status(500).json({ message: "登录失败，请稍后重试" });
    }
});

// 邮箱检查接口
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
        return res.status(500).json({ message: "检查邮箱时出错" });
    }
});

module.exports = router;
