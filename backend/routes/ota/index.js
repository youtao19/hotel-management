"use strict";

const express = require('express');
const douyinRoute = require('./douyinRoute');
const fliggyRoute = require('./fliggyRoute');

const router = express.Router();

router.use('/douyin', douyinRoute);
router.use('/fliggy', fliggyRoute);

module.exports = router;
