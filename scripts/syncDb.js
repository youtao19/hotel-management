#!/usr/bin/env node

const { syncSchema } = require('../backend/database/postgreDB/syncSchema');

console.log('开始同步数据库...');

syncSchema()
    .then(() => {
        console.log('数据库同步完成！');
        process.exit(0);
    })
    .catch(error => {
        console.error('数据库同步失败:', error);
        process.exit(1);
    });
