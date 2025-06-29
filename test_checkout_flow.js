const axios = require('axios');

async function testCheckoutFlow() {
    try {
        console.log('=== 测试退房和好评邀请流程 ===\n');

        // 1. 首先我们需要有一个入住的订单来测试退房
        console.log('1. 查找可以退房的订单...');
        const ordersResponse = await axios.get('http://localhost:3000/api/orders/all');

        // 找一个已入住的订单
        const checkedInOrders = ordersResponse.data.orders?.filter(order =>
            order.status === 'checked-in'
        ) || [];

        if (checkedInOrders.length === 0) {
            console.log('❌ 没有找到已入住的订单，无法测试退房流程');
            console.log('   建议：先创建一个订单并办理入住，然后再测试退房功能');
            return;
        }

        const testOrder = checkedInOrders[0];
        console.log('✅ 找到测试订单:', {
            order_id: testOrder.order_id,
            guest_name: testOrder.guest_name,
            room_number: testOrder.room_number,
            status: testOrder.status
        });

        // 2. 测试退房API
        console.log('\n2. 测试退房API...');
        const checkoutResponse = await axios.patch(
            `http://localhost:3000/api/orders/updateStatus/${testOrder.order_id}`,
            { status: 'checked-out' }
        );

        if (checkoutResponse.data.success) {
            console.log('✅ 退房API调用成功');
        } else {
            console.log('❌ 退房API调用失败');
            return;
        }

        // 3. 等待一下，然后检查是否生成了账单
        console.log('\n3. 检查是否生成了账单...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const billResponse = await axios.get(`http://localhost:3000/api/bills/${testOrder.order_id}`);

        if (billResponse.data.bill) {
            console.log('✅ 账单已生成:', {
                order_id: billResponse.data.bill.order_id,
                guest_name: billResponse.data.bill.guest_name,
                review_invited: billResponse.data.bill.review_invited
            });

            // 4. 测试好评邀请
            if (!billResponse.data.bill.review_invited) {
                console.log('\n4. 测试好评邀请...');
                const inviteResponse = await axios.post(
                    `http://localhost:3000/api/bills/${testOrder.order_id}/invite-review`
                );

                if (inviteResponse.data.message === '好评邀请发送成功') {
                    console.log('✅ 好评邀请测试成功');
                } else {
                    console.log('❌ 好评邀请测试失败');
                }
            } else {
                console.log('ℹ️  该账单已经邀请过好评');
            }
        } else {
            console.log('❌ 账单未生成');
        }

        console.log('\n=== 测试完成 ===');
        console.log('💡 提示：');
        console.log('   - 如果API测试成功，但前端退房时没有弹出好评邀请对话框');
        console.log('   - 请检查浏览器开发者工具的控制台，查看是否有JavaScript错误');
        console.log('   - 确保前端代码中的 showReviewInvitationDialog 函数被正确调用');

    } catch (error) {
        console.error('测试失败:', error.response?.data || error.message);
    }
}

testCheckoutFlow();
