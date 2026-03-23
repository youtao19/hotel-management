const crypto = require('crypto')

// 标准化为字符串数组
function normalizeQueryValue(value) {
  if (Array.isArray(value)) {
    return [...value].map(String).sort()
  }

  if (value === undefined || value === null) {
    return []
  }

  return [String(value)]
}

/**
 * 按抖音签名规则构建待签名字符串（不包含哈希计算）。
 * 规则：
 * 1. query 参数按 key 字典序排序；
 * 2. 排除 sign 字段，避免把签名本身再次参与签名；
 * 3. 以 clientSecret 作为前缀，按 &key=value 依次拼接；
 * 4. 数组参数会先标准化并排序后逐项拼接；
 * 5. rawBody 存在时追加 &http_body=原始请求体。
*/
function buildSignString({ query = {}, rawBody = '', clientSecret = '' }) {
  const keys = Object.keys(query)
    .filter((key) => key !== 'sign') // 排除 sign 字段（防止“签名参与签名”）
    .sort()

  let signString = clientSecret

  for (const key of keys) {
    const values = normalizeQueryValue(query[key])
    for (const value of values) {
      signString += `&${key}=${value}`
    }
  }

  if (rawBody) {
    signString += `&http_body=${rawBody}`
  }

  return signString
}

// 生成 SHA256 签名
function generateSha256Signature({ query = {}, rawBody = '', clientSecret = '' }) {
  const signString = buildSignString({ query, rawBody, clientSecret })

  return crypto
    .createHash('sha256')
    .update(signString, 'utf8')
    .digest('hex')
}

// 校验传入签名是否正确
function verifySha256Signature({ query = {}, rawBody = '', clientSecret = '', signature = '' }) {
  if (!signature) return false

  // 用同样的参数重新计算签名
  const calculatedSignature = generateSha256Signature({
    query,
    rawBody,
    clientSecret,
  })

  // 比较计算结果和传入签名（忽略大小写）
  return calculatedSignature === String(signature).toLowerCase()
}

module.exports = {
  buildSignString,
  generateSha256Signature,
  verifySha256Signature,
}
