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
router.use(authentication.ensureAuthenticated);

router.get("/info", async (req, res) => {
    try {
        const getAccountQuery = {
            text: `SELECT id, name, email,email_verified FROM ${account.tableName} WHERE id = $1`,
            values: [req.session.account.id]
        };
        const result = await db.query(getAccountQuery);
        if(result.rows.length === 0){
            throw new Error(`can not find account using id : ${req.session.account.id}`);
        } else {
            return res.status(200).json(result.rows[0]);
        }
    } catch (e) {
        console.log(`/info route failed with ${e}`);
        return res.status(500).json();
    }
});

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

router.get("/logout", async (req, res, next) => {
    try {
        await req.logout();
        return res.status(200).json();
    } catch (e) {
        console.log(e);
        return res.status(500).json();
    }
});

module.exports = router;