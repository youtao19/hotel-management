const { query } = require('../backend/database/postgreDB/pg');

async function migrateReviewFields() {
  try {
    console.log('开始为bills表添加好评相关字段...');

    // 添加好评邀请相关字段
    const alterTableSQL = `
      ALTER TABLE bills 
      ADD COLUMN IF NOT EXISTS review_invited BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS positive_review BOOLEAN DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS review_invite_time TIMESTAMP DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS review_update_time TIMESTAMP DEFAULT NULL;
    `;

    await query(alterTableSQL);
    console.log('✓ 字段添加成功');

    // 添加注释说明字段用途
    const commentSQL = `
      COMMENT ON COLUMN bills.review_invited IS '是否已邀请客户进行好评';
      COMMENT ON COLUMN bills.positive_review IS '客户是否给出好评，NULL表示未设置，TRUE表示好评，FALSE表示差评';
      COMMENT ON COLUMN bills.review_invite_time IS '发送好评邀请的时间';
      COMMENT ON COLUMN bills.review_update_time IS '更新好评状态的时间';
    `;

    await query(commentSQL);
    console.log('✓ 字段注释添加成功');

    // 创建索引以提高查询性能
    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_bills_review_invited ON bills(review_invited);
      CREATE INDEX IF NOT EXISTS idx_bills_positive_review ON bills(positive_review);
      CREATE INDEX IF NOT EXISTS idx_bills_review_invite_time ON bills(review_invite_time);
    `;

    await query(indexSQL);
    console.log('✓ 索引创建成功');

    // 验证字段是否添加成功
    const verifySQL = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'bills' 
      AND column_name IN ('review_invited', 'positive_review', 'review_invite_time', 'review_update_time')
      ORDER BY column_name;
    `;

    const result = await query(verifySQL);
    console.log('✓ 字段验证结果:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });

    console.log('\n🎉 数据库迁移完成！好评功能相关字段已成功添加到bills表。');

  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    throw error;
  }
}

// 执行迁移
if (require.main === module) {
  migrateReviewFields()
    .then(() => {
      console.log('迁移脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('迁移脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { migrateReviewFields };
