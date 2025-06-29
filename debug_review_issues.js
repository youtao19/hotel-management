const { query } = require('./backend/database/postgreDB/pg');

async function debugReviewIssues() {
    try {
        console.log('=== 调试好评功能问题 ===\n');

        // 1. 检查是否有退房订单
        console.log('1. 检查退房订单...');
        const checkedOutOrders = await query(`
            SELECT order_id, guest_name, room_number, status, check_out_date
            FROM orders
            WHERE status = 'checked-out'
            ORDER BY check_out_date DESC
            LIMIT 5;
        `);

        if (checkedOutOrders.rows.length > 0) {
            console.log('✅ 找到退房订单:');
            console.table(checkedOutOrders.rows);
        } else {
            console.log('❌ 没有找到退房订单');
        }

        // 2. 检查账单表
        console.log('\n2. 检查账单表...');
        const bills = await query(`
            SELECT order_id, guest_name, room_number, review_invited, positive_review,
                   review_invite_time, review_update_time, create_time
            FROM bills
            ORDER BY create_time DESC
            LIMIT 5;
        `);

        if (bills.rows.length > 0) {
            console.log('✅ 找到账单记录:');
            console.table(bills.rows);
        } else {
            console.log('❌ 没有找到账单记录');
        }

        // 3. 检查待邀请好评的账单
        console.log('\n3. 检查待邀请好评的账单...');
        const pendingInvitations = await query(`
            SELECT b.*, o.guest_name, o.phone, o.check_out_date
            FROM bills b
            JOIN orders o ON b.order_id = o.order_id
            WHERE o.status = 'checked-out'
            AND b.review_invited = FALSE
            ORDER BY b.create_time DESC;
        `);

        if (pendingInvitations.rows.length > 0) {
            console.log('✅ 找到待邀请好评的账单:');
            console.table(pendingInvitations.rows);
        } else {
            console.log('❌ 没有找到待邀请好评的账单');
        }

        // 4. 检查已邀请但未设置状态的账单
        console.log('\n4. 检查已邀请但未设置状态的账单...');
        const pendingReviews = await query(`
            SELECT b.*, o.guest_name, o.phone, o.check_out_date
            FROM bills b
            JOIN orders o ON b.order_id = o.order_id
            WHERE b.review_invited = TRUE
            AND b.positive_review IS NULL
            ORDER BY b.review_invite_time DESC;
        `);

        if (pendingReviews.rows.length > 0) {
            console.log('✅ 找到已邀请但未设置状态的账单:');
            console.table(pendingReviews.rows);
        } else {
            console.log('❌ 没有找到已邀请但未设置状态的账单');
        }

        // 5. 检查所有订单和账单的关联情况
        console.log('\n5. 检查订单和账单的关联情况...');
        const orderBillRelation = await query(`
            SELECT
                o.order_id,
                o.guest_name,
                o.status as order_status,
                o.check_out_date,
                CASE WHEN b.order_id IS NOT NULL THEN '有账单' ELSE '无账单' END as bill_status,
                b.review_invited,
                b.positive_review
            FROM orders o
            LEFT JOIN bills b ON o.order_id = b.order_id
            WHERE o.status = 'checked-out'
            ORDER BY o.check_out_date DESC
            LIMIT 10;
        `);

        if (orderBillRelation.rows.length > 0) {
            console.log('✅ 订单和账单关联情况:');
            console.table(orderBillRelation.rows);
        } else {
            console.log('❌ 没有找到订单和账单关联数据');
        }

        console.log('\n=== 调试完成 ===');
        process.exit(0);

    } catch (error) {
        console.error('调试失败:', error);
        process.exit(1);
    }
}

debugReviewIssues();
