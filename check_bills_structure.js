const { query } = require('./backend/database/postgreDB/pg');

async function checkBillsStructure() {
    try {
        console.log('检查bills表结构...');
        const result = await query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'bills'
            ORDER BY ordinal_position;
        `);

        console.log('Bills表结构:');
        console.table(result.rows);

        // 检查是否有好评相关字段
        const reviewFields = result.rows.filter(row =>
            row.column_name.includes('review') ||
            row.column_name.includes('positive')
        );

        if (reviewFields.length > 0) {
            console.log('\n找到好评相关字段:');
            console.table(reviewFields);
        } else {
            console.log('\n❌ 未找到好评相关字段，需要执行迁移脚本');
        }

        process.exit(0);
    } catch (error) {
        console.error('检查失败:', error);
        process.exit(1);
    }
}

checkBillsStructure();
