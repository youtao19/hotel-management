"use strict";

const { douyinConfig } = require('../../../appSettings/douyin.config');
const repository = require('./douyinSettings.repository');

/** 返回当前抖音支持设置，首次使用时沿用部署配置的默认值。 */
async function getSettings() {
  const savedSettings = await repository.findSettings();
  if (savedSettings) return savedSettings;
  return {
    auto_confirm_enabled: douyinConfig.autoConfirmEnabled,
    updated_by: null,
    updated_at: null
  };
}

/** 判断新预约订单是否应自动确认接单。 */
async function isAutoConfirmEnabled() {
  const settings = await getSettings();
  return settings.auto_confirm_enabled === true;
}

/** 保存员工选择的自动接单开关。 */
async function updateAutoConfirmEnabled(autoConfirmEnabled, account) {
  if (typeof autoConfirmEnabled !== 'boolean') {
    const error = new Error('autoConfirmEnabled 必须是布尔值');
    error.statusCode = 400;
    throw error;
  }
  return repository.saveAutoConfirmEnabled(autoConfirmEnabled, account?.id);
}

module.exports = {
  getSettings,
  isAutoConfirmEnabled,
  updateAutoConfirmEnabled
};
