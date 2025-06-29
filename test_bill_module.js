const billModule = require('./backend/modules/billModule');

async function testBillModule() {
    try {
        console.log('=== 测试 billModule 函数 ===\n');

        // 1. 测试 getPendingReviewInvitations
        console.log('1. 测试 getPendingReviewInvitations...');
        const pendingInvitations = await billModule.getPendingReviewInvitations();
        console.log('返回数据:', pendingInvitations);
        console.log('数据类型:', typeof pendingInvitations);
        console.log('是否为数组:', Array.isArray(pendingInvitations));
        console.log('数组长度:', pendingInvitations?.length);

        // 2. 测试 getPendingReviewUpdates
        console.log('\n2. 测试 getPendingReviewUpdates...');
        const pendingUpdates = await billModule.getPendingReviewUpdates();
        console.log('返回数据:', pendingUpdates);
        console.log('数据类型:', typeof pendingUpdates);
        console.log('是否为数组:', Array.isArray(pendingUpdates));
        console.log('数组长度:', pendingUpdates?.length);

        // 3. 测试 getAllBills
        console.log('\n3. 测试 getAllBills...');
        const allBills = await billModule.getAllBills();
        console.log('返回数据长度:', allBills?.length);
        console.log('前3条数据:');
        if (allBills && allBills.length > 0) {
            console.table(allBills.slice(0, 3));
        }

        console.log('\n=== 测试完成 ===');
        process.exit(0);

    } catch (error) {
        console.error('测试失败:', error);
        process.exit(1);
    }
}

testBillModule();
