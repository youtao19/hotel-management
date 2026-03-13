const { createPluginOrderService } = require("./plugin-order.service");

// 当前允许接入的插件平台列表，统一在路由层做第一道兜底校验。
const ALLOWED_PLATFORMS = ["meituan", "ctrip"];
/*
data = {
  "platform": "meituan",
  "otaOrderId": "1234567890",
  "guestName": "张三",
  "roomType": "大床房",
  "checkInDate": "2024-07-01",
  "checkOutDate": "2024-07-03",
  "roomPrice": {
    "yyyy-mm-dd": xx,
    "yyyy-mm-dd": xx
    },
  }
*/
async function createPluginOrder(req, res) {
  try {
    // 保留原始请求体供服务层记录事件日志和原始 OTA 报文。
    const body = req.body;

    const {
      platform,
      otaOrderId,
      guestName,
      roomType,
      checkInDate,
      checkOutDate,
      roomPrice
    } = body;




    if (!platform || !otaOrderId) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PARAMS",
        message: "platform 和 otaOrderId 为必填参数"
      });
    }

    if (!ALLOWED_PLATFORMS.includes(platform)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PLATFORM",
        message: "platform 不在允许范围内"
      });
    }

    const result = await createPluginOrderService({
      ...body,
      pluginAuth: req.pluginAuth
    });
    console.log("createPluginOrder result:", result.message);

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      code: "PLUGIN_ORDER_CREATE_FAILED",
      message: error.message || "插件订单创建失败",
    });
  }
}

module.exports = {
  createPluginOrder
};
