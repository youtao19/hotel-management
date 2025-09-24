// 简化的登录路由用于调试
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const Ajv = require("ajv");
const ajv = new Ajv();
const addFormats = require("ajv-formats");
addFormats(ajv);
const db = require("../database/postgreDB/pg");
const account = require("../database/postgreDB/tables/account");

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

// 简化的登录路由，跳过限流检查
router.post("/debug-login", async (req, res) => {
    try {
        console.log('调试登录开始，请求数据:', req.body);

        const valid = validateLogin(req.body);
        if (!valid) {
            console.log('输入验证失败:', validateLogin.errors);
            return res.status(400).json({ message: "输入数据无效" });
        }

        console.log('输入验证通过');

        const getPWQuery = {
            text: `SELECT * FROM ${account.tableName} where email=$1`,
            values: [req.body.email]
        }

        console.log('执行数据库查询...');
        const result = await db.query(getPWQuery);
        console.log('数据库查询结果:', result.rows.length, '条记录');

        if (result.rows.length === 0) {
            console.log('用户不存在');
            return res.status(404).json({ message: "用户不存在" });
        }

        console.log('找到用户，开始验证密码');
        const match = await bcrypt.compare(req.body.pw, result.rows[0].pw);
        console.log('密码验证结果:', match);

        if (match) {
            const { id, name, email } = result.rows[0];
            const params = {
                account: { id, name, email }
            };

            console.log('密码正确，开始设置session');

            try {
                await req.login(params);
                console.log('Session设置成功');
                return res.status(200).json(params.account);
            } catch (sessionError) {
                console.error('Session设置失败:', sessionError);
                return res.status(500).json({ message: "Session设置失败: " + sessionError.message });
            }
        } else {
            console.log('密码错误');
            return res.status(401).json({ message: "密码错误" });
        }

    } catch (e) {
        console.error(`调试登录错误: ${e.message}`);
        console.error(`错误堆栈: ${e.stack}`);
        return res.status(500).json({ message: "登录失败: " + e.message });
    }
});

module.exports = router;
