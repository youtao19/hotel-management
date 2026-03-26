const { DOUYIN_COMMON_ERROR } = require('../constants/errorCodes')

/**
 * 创建抖音业务异常对象。
 *
 * @param {{code:number, description:string}} definition 错误定义。
 * @param {string} [message] 内部错误信息。
 * @param {string} [descriptionOverride] 返回给上层的错误描述覆盖值。
 * @returns {Error} 挂载抖音错误码和描述的异常对象。
 */
function createDouyinBusinessError(definition, message, descriptionOverride) {
  const error = new Error(message || definition.description)
  error.douyinErrorCode = definition.code
  error.douyinDescription = descriptionOverride || definition.description
  return error
}

/**
 * 从异常对象中解析抖音错误码与描述。
 *
 * @param {Error} error 原始异常对象。
 * @param {{code:number, description:string}} [fallbackDefinition] 默认兜底错误定义。
 * @returns {{errorCode:number, description:string}} 解析后的抖音错误信息。
 */
function resolveDouyinBusinessError(
  error,
  fallbackDefinition = DOUYIN_COMMON_ERROR.OTHER_EXCEPTION
) {
  return {
    errorCode: Number.isInteger(error?.douyinErrorCode)
      ? error.douyinErrorCode
      : fallbackDefinition.code,
    description: error?.douyinDescription || fallbackDefinition.description,
  }
}

module.exports = {
  createDouyinBusinessError,
  resolveDouyinBusinessError,
}
