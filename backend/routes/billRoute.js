"use strict";
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const billModule = require('../modules/billModule');

// 创建账单
router.post('/create', async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { order_id, room_number, guest_name, deposit, refund_deposit, room_fee, total_income, pay_way, remarks } = req.body;

     // 转换 refund_deposit 从字符串到布尔值
     let refund_deposit_bool = true;
     if(refund_deposit === 'yes'){
        refund_deposit_bool = true;
    }else{
        refund_deposit_bool = false;
    }

    const way = pay_way.value

    try {
        console.log('收到账单数据',req.body)
        console.log('way:',way)
        const bill = await billModule.createBill(order_id, room_number, guest_name, deposit, refund_deposit_bool, room_fee, total_income, way, remarks);
        res.status(201).json({ message: '账单创建成功', bill });
    } catch (error) {
        res.status(500).json({ message: '创建账单失败', error: error.message });
    }
});

module.exports = router;