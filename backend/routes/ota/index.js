"use strict";

const express = require('express');
const fliggyRoute = require('./fliggyRoute');

const router = express.Router();

router.use('/fliggy', fliggyRoute);

module.exports = router;
