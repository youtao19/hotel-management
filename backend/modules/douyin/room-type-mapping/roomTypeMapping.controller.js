const service = require('./roomTypeMapping.service');
const {
  getValidationMessage,
  normalizeMappings,
  normalizeOptions,
  normalizeString,
  validateSaveMappings,
  validateSyncOptions
} = require('./roomTypeMapping.validator');

async function listMappings(_req, res) {
  try {
    const data = await service.getMappingPageData();
    return res.status(200).json({
      data,
      message: '抖音房型匹配列表获取成功'
    });
  } catch (error) {
    console.error('获取抖音房型匹配列表失败:', error);
    return res.status(500).json({ message: '服务器错误', error: error.message });
  }
}

async function refreshRooms(req, res) {
  try {
    const payload = normalizeOptions(req.body || {});
    const valid = validateSyncOptions(payload);
    if (!valid) {
      return res.status(400).json({
        message: '请求数据格式错误',
        errors: validateSyncOptions.errors,
        detail: getValidationMessage(validateSyncOptions.errors)
      });
    }

    const result = await service.refreshRooms(payload);
    return res.status(200).json({
      data: result.data,
      message: `已刷新 ${result.refreshResult.savedCount} 个抖音物理房型`
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    const log = statusCode >= 500 ? console.error : console.warn;
    log('刷新抖音物理房型失败:', error.message);
    if (error.douyinLogId) {
      log('抖音 logid:', error.douyinLogId);
    }
    return res.status(statusCode).json({
      message: statusCode >= 500 ? '刷新抖音物理房型失败' : error.message,
      error: error.message,
      douyin_log_id: error.douyinLogId || null
    });
  }
}

async function saveMappings(req, res) {
  try {
    const payload = normalizeMappings(req.body || {});
    const valid = validateSaveMappings(payload);
    if (!valid) {
      return res.status(400).json({
        message: '请求数据格式错误',
        errors: validateSaveMappings.errors,
        detail: getValidationMessage(validateSaveMappings.errors)
      });
    }

    const data = await service.saveMappings(payload.mappings);
    return res.status(200).json({
      data,
      message: '抖音房型匹配保存成功'
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    const log = statusCode >= 500 ? console.error : console.warn;
    log('保存抖音房型匹配失败:', error.message);
    return res.status(statusCode).json({
      message: statusCode >= 500 ? '保存抖音房型匹配失败' : error.message,
      error: error.message
    });
  }
}

async function deleteMapping(req, res) {
  try {
    const localRoomType = normalizeString(req.params.localRoomType || '');
    if (!localRoomType) {
      return res.status(400).json({ message: '本地房型编码不能为空' });
    }

    const data = await service.deleteMapping(localRoomType);
    if (!data) {
      return res.status(404).json({ message: '抖音房型匹配不存在' });
    }

    return res.status(200).json({
      data,
      message: '抖音房型匹配已解除'
    });
  } catch (error) {
    console.error('解除抖音房型匹配失败:', error);
    return res.status(500).json({ message: '解除抖音房型匹配失败', error: error.message });
  }
}

module.exports = {
  deleteMapping,
  listMappings,
  refreshRooms,
  saveMappings
};
