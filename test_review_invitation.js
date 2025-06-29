const axios = require('axios');

async function testReviewInvitation() {
    try {
        const baseURL = 'http://localhost:3000'; // 后端端口

        console.log('=== 测试好评邀请功能 ===\n');

        // 1. 获取一个待邀请好评的订单
        console.log('1. 获取待邀请好评的账单...');
        const pendingResponse = await axios.get(`${baseURL}/api/bills/pending-invitations`);

        console.log('API响应:', {
            status: pendingResponse.status,
            data: pendingResponse.data
        });

        if (!pendingResponse.data.bills || pendingResponse.data.bills.length === 0) {
            console.log('❌ 没有找到待邀请好评的账单');
            console.log('完整响应数据:', JSON.stringify(pendingResponse.data, null, 2));
            return;
        }

        const testBill = pendingResponse.data.bills[0];
        console.log('✅ 找到测试账单:', {
            order_id: testBill.order_id,
            guest_name: testBill.guest_name,
            review_invited: testBill.review_invited
        });

        // 2. 测试邀请好评API
        console.log('\n2. 测试邀请好评API...');
        const inviteResponse = await axios.post(`${baseURL}/api/bills/${testBill.order_id}/invite-review`);

        console.log('API响应:', {
            status: inviteResponse.status,
            data: inviteResponse.data
        });

        if (inviteResponse.data.message === '好评邀请发送成功') {
            console.log('✅ 邀请好评API调用成功');
            console.log('   更新后的账单:', {
                order_id: inviteResponse.data.bill.order_id,
                review_invited: inviteResponse.data.bill.review_invited,
                review_invite_time: inviteResponse.data.bill.review_invite_time
            });
        } else {
            console.log('❌ 邀请好评API调用失败');
        }

        // 3. 验证数据已更新
        console.log('\n3. 验证数据是否已更新...');
        const checkResponse = await axios.get(`${baseURL}/api/bills/${testBill.order_id}`);

        if (checkResponse.data.bill.review_invited) {
            console.log('✅ 数据更新成功，review_invited = true');
        } else {
            console.log('❌ 数据更新失败，review_invited = false');
        }

        // 4. 测试重复邀请
        console.log('\n4. 测试重复邀请检查...');
        try {
            await axios.post(`${baseURL}/api/bills/${testBill.order_id}/invite-review`);
            console.log('❌ 重复邀请检查失败');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ 重复邀请检查正常');
            } else {
                console.log('❌ 重复邀请检查出现意外错误:', error.message);
            }
        }

        console.log('\n=== 测试完成 ===');

    } catch (error) {
        console.error('测试失败:', error.response?.data || error.message);
    }
}

testReviewInvitation();
