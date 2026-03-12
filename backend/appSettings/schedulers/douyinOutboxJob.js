"use strict";
// 自动重试并发送抖音房态/价格同步任务
const cron = require('node-cron');
const setup = require('../setup');
const { processPendingOutboxTasks } = require('../../modules/ota/douyin/roomSyncService');

let cronTask = null;

/**
 * 启动抖音 outbox 自动消费任务。
 * @returns {object|null} cron 任务实例
 */
function startDouyinOutboxJob() {
  if (!setup.douyinOutboxJob.enabled) {
    console.info('[douyinOutboxJob] 已禁用，未启动计划任务');
    return null;
  }

  if (cronTask) {
    return cronTask;
  }

  const expression = setup.douyinOutboxJob.cron;
  const timezone = setup.douyinOutboxJob.timezone || 'Asia/Shanghai';
  const batchSize = setup.douyinOutboxJob.batchSize || 10;

  cronTask = cron.schedule(expression, async () => {
    console.info(`[douyinOutboxJob] ${new Date().toLocaleString('zh-CN', { hour12: false })} 开始执行`);
    try {
      const results = await processPendingOutboxTasks(batchSize);
      console.info(`[douyinOutboxJob] 本次处理 ${results.length} 条任务`);
    } catch (error) {
      console.error('[douyinOutboxJob] 执行失败:', error);
    }
  }, { timezone });

  console.info(`[douyinOutboxJob] 已注册 cron 任务：${expression}（${timezone}）`);
  return cronTask;
}

/**
 * 停止抖音 outbox 自动消费任务。
 * @returns {void}
 */
function stopDouyinOutboxJob() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.info('[douyinOutboxJob] 定时任务已停止');
  }
}

module.exports = {
  startDouyinOutboxJob,
  stopDouyinOutboxJob
};
