const {
  listPluginRoomTypeMappingsService,
  createPluginRoomTypeMappingService,
  updatePluginRoomTypeMappingService
} = require("./room-map.services");

async function listPluginRoomTypeMappings(req, res) {
  try {
    const { platform } = req.query;

    const data = await listPluginRoomTypeMappingsService({ platform });
    return res.status(200).json({
      success: true,
      code: "PLUGIN_ROOM_TYPE_MAPPING_LIST",
      data,
      message: '插件房型映射列表获取成功'
    });
  } catch (error) {
    console.error("获取插件房型映射列表时发生错误:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "服务器内部错误"
    });
  }
};

async function createPluginRoomTypeMappings(req, res) {
  try {
    const { platform, mappings } = req.body;

    if (!platform) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PARAMS",
        message: "platform 为必填参数"
      })
    }

    if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PARAMS",
        message: "mappings 必须为对象"
      })
    }

    const otaRoomTypes = Object.keys(mappings);
    if (!otaRoomTypes.length) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PARAMS",
        message: "mappings 不能为空"
      })
    }

    for (const otaRoomType of otaRoomTypes) {
      const mappingItem = mappings[otaRoomType];

      if (!mappingItem || typeof mappingItem !== 'object') {
        return res.status(400).json({
          success: false,
          code: "INVALID_PARAMS",
          message: `房型${otaRoomType}的映射数据格式不正确`
        })
      }

      if (!mappingItem.value) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PARAMS",
          message: `房型${otaRoomType}的映射数据缺少value字段`
        })
      }
    }

    /**
 * 插件房型映射批量保存数据。
 */
    const mappingList = Object.entries(mappings).map(([otaRoomType, mappingItem]) => {
      return {
        otaRoomType,
        localRoomType: mappingItem.value
      };
    });

    const result = await createPluginRoomTypeMappingService({ platform, mappingList });
    res.status(200).json(result);
  } catch (error) {
    console.error("创建插件房间类型映射时发生错误:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "服务器内部错误"
    });
  }


};

async function updatePluginRoomTypeMappings(req, res) { };

module.exports = {
  listPluginRoomTypeMappings,
  createPluginRoomTypeMappings,
  updatePluginRoomTypeMappings
}
