#!/usr/bin/env node

const { initializeHotelDB, query } = require('../database/postgreDB/pg');

(async () => {
  try {
    console.log('开始同步数据库结构...');
    await initializeHotelDB();

    // 迁移 handover.task_list 为 JSONB（幂等）
    console.log('检查并迁移 handover.task_list 到 JSONB ...');
    await query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'handover' AND column_name = 'task_list' AND data_type <> 'jsonb'
        ) THEN
          -- 先移除默认值，避免类型变更时报默认值无法转换
          BEGIN
            EXECUTE 'ALTER TABLE handover ALTER COLUMN task_list DROP DEFAULT';
          EXCEPTION WHEN others THEN
            -- 忽略无默认值或重复执行错误
            NULL;
          END;

          ALTER TABLE handover
            ALTER COLUMN task_list TYPE jsonb USING (
              CASE
                WHEN task_list IS NULL THEN '[]'::jsonb
                ELSE to_jsonb(task_list)
              END
            );
          ALTER TABLE handover ALTER COLUMN task_list SET DEFAULT '[]'::jsonb;
        END IF;
      END $$;
    `);
    console.log('handover.task_list 迁移检查完成');

    console.log('数据库结构同步完成');
    process.stdout.write('Database synced.\n');
    process.exit(0);
  } catch (err) {
    console.error('数据库结构同步失败:', err);
    process.exit(1);
  }
})();
