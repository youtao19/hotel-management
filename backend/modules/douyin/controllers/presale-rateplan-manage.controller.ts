/**
 * 文件作用：
 * 提供“创建/更新预定商品”的控制器入口。
 *
 * 这个文件只负责三件事：
 * 1. 从请求体提取参数；
 * 2. 调用 service；
 * 3. 返回尽量贴近官方的响应结构。
 *
 * 之所以不在 controller 里做复杂判断，
 * 是为了让“查 room_ids、查 rate_plans、判断创建还是更新”都留在 service 层统一处理。
 */

import type { Request, Response } from 'express'

const { resolveDouyinBusinessError } = require('../utils/douyinError') as {
  resolveDouyinBusinessError: (
    error: Error
  ) => {
    errorCode: number
    description: string
  }
}
const { managePresaleRateplan } = require('../services/presale-rateplan-manage.service') as {
  managePresaleRateplan: (params: ManagePresaleRateplanBody) => Promise<ManagePresaleRateplanResult>
}

type PresaleRateplanHourlyRoomDetail = {
  usageDuration: string
  earliestCheckIn: string
  latestCheckOut: string
}

type ManagePresaleRateplanBody = {
  accountId?: string
  poiId: string
  roomId?: string
  ratePlanName: string
  outRatePlanId: string
  active?: boolean
  currency?: string
  salesType?: number
  hourlyRoomDetail?: PresaleRateplanHourlyRoomDetail
}

type PresaleRateplanMapItem = {
  outRatePlanId: string
  ratePlanId: string
  code: string
  message: string
}

type PresaleRateplanSaveData = {
  gw_error_code?: number
  gwErrorCode?: number
  gw_description?: string
  gwDescription?: string
  ratePlanMap?: PresaleRateplanMapItem[]
}

type DouyinSdkExtra = {
  error_code?: number
  errorCode?: number
  description?: string
  sub_description?: string
  subDescription?: string
  logid?: string
  now?: string
}

type ManagePresaleRateplanResult = {
  saveResult: {
    raw: {
      data?: PresaleRateplanSaveData | null
      extra?: DouyinSdkExtra | null
    }
  }
}

type PresaleRateplanSuccessResponse = {
  data?: PresaleRateplanSaveData | null
  extra?: DouyinSdkExtra | null
}

type PresaleRateplanErrorResponse = {
  data: {
    gw_error_code: number
    gw_description: string
    rate_plan_map: []
  }
  extra: {
    error_code: number
    description: string
  }
}

/**
 * 解析创建/更新预定商品请求体。
 *
 * @param {Record<string, unknown>} body 原始请求体。
 * @returns {ManagePresaleRateplanBody} 规范化后的业务参数。
 */
function resolveManagePresaleRateplanBody(
  body: Record<string, unknown> = {}
): ManagePresaleRateplanBody {
  const rawHourlyRoomDetail = body.hourlyRoomDetail
  const hasHourlyRoomDetail =
    rawHourlyRoomDetail !== null &&
    typeof rawHourlyRoomDetail === 'object' &&
    !Array.isArray(rawHourlyRoomDetail)

  const hourlyRoomDetail = hasHourlyRoomDetail
    ? {
        usageDuration: String(
          (rawHourlyRoomDetail as { usageDuration?: string }).usageDuration || ''
        ).trim(),
        earliestCheckIn: String(
          (rawHourlyRoomDetail as { earliestCheckIn?: string }).earliestCheckIn || ''
        ).trim(),
        latestCheckOut: String(
          (rawHourlyRoomDetail as { latestCheckOut?: string }).latestCheckOut || ''
        ).trim(),
      }
    : undefined

  return {
    accountId: String(body.accountId || '').trim() || undefined,
    poiId: String(body.poiId || '').trim(),
    roomId: String(body.roomId || '').trim() || undefined,
    ratePlanName: String(body.ratePlanName || '').trim(),
    outRatePlanId: String(body.outRatePlanId || '').trim(),
    active: body.active === undefined ? true : body.active === true,
    currency: String(body.currency || '').trim() || undefined,
    salesType: body.salesType === undefined ? undefined : Number(body.salesType),
    hourlyRoomDetail,
  }
}

/**
 * 构建成功响应。
 *
 * 成功时直接返回 SDK 的原始响应，
 * 这样可以最大程度贴近官方接口，而不是再套一层本地字段。
 *
 * @param {ManagePresaleRateplanResult} result service 处理结果。
 * @returns {PresaleRateplanSuccessResponse} 官方风格成功响应。
 */
function buildPresaleRateplanSuccessResponse(
  result: ManagePresaleRateplanResult
): PresaleRateplanSuccessResponse {
  return result.saveResult.raw
}

/**
 * 构建失败响应。
 *
 * 对于本地参数校验或业务判断失败，这里统一补出最小官方风格结构，
 * 这样联调时返回字段不会和成功分支完全不同。
 *
 * @param {{errorCode:number, description:string}} params 错误参数。
 * @returns {PresaleRateplanErrorResponse} 官方风格失败响应。
 */
function buildPresaleRateplanErrorResponse({
  errorCode,
  description,
}: {
  errorCode: number
  description: string
}): PresaleRateplanErrorResponse {
  return {
    data: {
      gw_error_code: errorCode,
      gw_description: description,
      rate_plan_map: [],
    },
    extra: {
      error_code: errorCode,
      description,
    },
  }
}

/**
 * 创建或更新预定商品。
 *
 * @param {Request} req Express 请求对象。
 * @param {Response} res Express 响应对象。
 * @returns {Promise<Response>} 响应结果。
 */
async function managePresaleRateplanController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const payload = resolveManagePresaleRateplanBody((req.body || {}) as Record<string, unknown>)
    const result = await managePresaleRateplan(payload)

    return res.json(buildPresaleRateplanSuccessResponse(result))
  } catch (error) {
    const { errorCode, description } = resolveDouyinBusinessError(error as Error)

    return res.status(400).json(buildPresaleRateplanErrorResponse({
      errorCode,
      description,
    }))
  }
}

module.exports = {
  buildPresaleRateplanErrorResponse,
  buildPresaleRateplanSuccessResponse,
  managePresaleRateplanController,
  resolveManagePresaleRateplanBody,
}
