"use strict";

const cron = require("node-cron");
const setup = require("../setup");
const { runAutoBillJob } = require("../../modules/bill/billAuto.service");

let cronTask = null;

function startAutoBillJob() {
  if (!setup.autoBillJob.enabled) {
    console.info('[autoBillJob] 已禁用，未启动计划任务');
    return null;
  }

  if (cronTask) {
    return cronTask;
  }

  const expression = setup.autoBillJob.cron;
  const timezone = setup.autoBillJob.timezone || 'Asia/Shanghai';

  cronTask = cron.schedule(expression, async () => {
    console.info(`[autoBillJob] ${new Date().toLocaleString('zh-CN', { hour12: false })} 开始执行`);
    try {
      await runAutoBillJob({ manualTrigger: false });
      console.info('[autoBillJob] 执行完成');
    } catch (err) {
      console.error('[autoBillJob] 执行失败:', err);
    }
  }, {
    timezone
  });

  console.info(`[autoBillJob] 已注册 cron 任务：${expression}（${timezone}）`);
  return cronTask;
}

function stopAutoBillJob() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.info('[autoBillJob] 定时任务已停止');
  }
}

async function runAutoBillJobOnce(options = {}) {
  return runAutoBillJob({ manualTrigger: true, forceRun: false, ...options });
}

module.exports = {
  startAutoBillJob,
  stopAutoBillJob,
  runAutoBillJobOnce
};
