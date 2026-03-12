"use strict";

const DouyinOpenApiSdk = require('@open-dy/open_api_sdk');
const DouyinOpenApiCredential = require('@open-dy/open_api_credential');

const DouyinOpenApiClient = DouyinOpenApiSdk.default;
const DouyinCredentialClient = DouyinOpenApiCredential.default;

/**
 * 从命令行参数中读取 `--key=value` 或 `--key value` 形式的参数。
 * @returns {Record<string, string>} 参数字典
 * @throws {Error} 无
 */
function parseCliArgs() {
  const args = process.argv.slice(2);
  const parsedArgs = {};

  for (let index = 0; index < args.length; index += 1) {
    const currentArg = args[index];
    if (!currentArg.startsWith('--')) {
      continue;
    }

    const content = currentArg.slice(2);
    const equalIndex = content.indexOf('=');
    if (equalIndex >= 0) {
      const key = content.slice(0, equalIndex);
      const value = content.slice(equalIndex + 1);
      parsedArgs[key] = value;
      continue;
    }

    const nextArg = args[index + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      parsedArgs[content] = nextArg;
      index += 1;
      continue;
    }

    parsedArgs[content] = 'true';
  }

  return parsedArgs;
}

/**
 * 读取字符串参数，优先命令行，其次环境变量。
 * @param {Record<string, string>} cliArgs 命令行参数
 * @param {string[]} candidateKeys 依次尝试的字段名
 * @returns {string} 清洗后的字符串
 * @throws {Error} 无
 */
function readStringOption(cliArgs, candidateKeys) {
  for (const key of candidateKeys) {
    const cliValue = cliArgs[key];
    if (typeof cliValue === 'string' && cliValue.trim()) {
      return cliValue.trim();
    }

    const envKey = key
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase();
    const envValue = process.env[envKey];
    if (typeof envValue === 'string' && envValue.trim()) {
      return envValue.trim();
    }
  }

  return '';
}

/**
 * 读取布尔参数。
 * @param {Record<string, string>} cliArgs 命令行参数
 * @param {string} key 参数名
 * @param {boolean} defaultValue 默认值
 * @returns {boolean} 布尔结果
 * @throws {Error} 无
 */
function readBooleanOption(cliArgs, key, defaultValue) {
  const rawValue = readStringOption(cliArgs, [key]);
  if (!rawValue) {
    return defaultValue;
  }

  if (['true', '1', 'yes', 'y'].includes(rawValue.toLowerCase())) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(rawValue.toLowerCase())) {
    return false;
  }

  return defaultValue;
}

/**
 * 读取数字参数。
 * @param {Record<string, string>} cliArgs 命令行参数
 * @param {string} key 参数名
 * @param {number} defaultValue 默认值
 * @returns {number} 数值结果
 * @throws {Error} 无
 */
function readNumberOption(cliArgs, key, defaultValue) {
  const rawValue = readStringOption(cliArgs, [key]);
  if (!rawValue) {
    return defaultValue;
  }

  const normalizedValue = Number(rawValue);
  return Number.isFinite(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : defaultValue;
}

/**
 * 读取房型 ID 列表参数。
 * @param {Record<string, string>} cliArgs 命令行参数
 * @returns {string[]} 房型 ID 列表
 * @throws {Error} 无
 */
function readRoomIds(cliArgs) {
  const rawValue = readStringOption(cliArgs, ['roomIds', 'room_ids']);
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 校验脚本必要参数。
 * @param {object} options 配置参数
 * @returns {void}
 * @throws {Error} 参数缺失时抛出异常
 */
function validateOptions(options) {
  if (!options.accountId) {
    throw new Error('缺少 accountId，请通过 --accountId 或环境变量 ACCOUNT_ID 传入。');
  }

  if (!options.accessToken && (!options.appId || !options.appSecret)) {
    throw new Error('缺少认证信息：请提供 accessToken，或同时提供 appId 与 appSecret。');
  }
}

/**
 * 创建官方 SDK 客户端。
 * @returns {object} SDK 客户端
 * @throws {Error} 无
 */
function createSdkClient() {
  const client = new DouyinOpenApiClient({
    clientKey: 'query-only',
    clientSecret: 'query-only'
  });

  client.setRuntimeOptions(new DouyinOpenApiSdk.RuntimeOptions({
    autoretry: true,
    ignoreSSL: false,
    maxAttempts: 2,
    readTimeout: 8000,
    connectTimeout: 3000
  }));

  return client;
}

/**
 * 通过 SDK 原始请求能力调用生活服务 OpenAPI，避免部分模型字段丢失。
 * @param {object} sdkClient SDK 客户端
 * @param {string} accessToken 调用 token
 * @param {string} path API 路径
 * @param {object} body 请求体
 * @returns {Promise<object>} 原始响应 JSON
 * @throws {Error} 请求失败时抛出异常
 */
async function callRawOpenApi(sdkClient, accessToken, path, body) {
  return sdkClient.commonOpenAPI(new DouyinOpenApiSdk.CommonRequest({
    host: 'open.douyin.com',
    path,
    method: 'POST',
    header: {
      'content-type': 'application/json',
      'access-token': accessToken
    },
    body
  }));
}

/**
 * 获取 access token。若已手工传入则直接使用，否则通过凭证 SDK 获取 client_token。
 * @param {object} options 配置参数
 * @returns {Promise<string>} 可用 token
 * @throws {Error} 获取失败时抛出异常
 */
async function resolveAccessToken(options) {
  if (options.accessToken) {
    return options.accessToken;
  }

  const credentialClient = new DouyinCredentialClient({
    clientKey: options.appId,
    clientSecret: options.appSecret
  });
  const tokenResult = await credentialClient.getClientToken();
  const accessToken = String(tokenResult?.accessToken || '').trim();
  if (!accessToken) {
    throw new Error('通过 SDK 获取 client_token 失败。');
  }

  return accessToken;
}

/**
 * 分页查询酒店列表。
 * @param {object} sdkClient SDK 客户端
 * @param {string} accessToken 调用 token
 * @param {string} accountId 抖音业务账号 ID
 * @param {number} pageSize 分页大小
 * @returns {Promise<object[]>} 酒店列表
 * @throws {Error} 查询失败时抛出异常
 */
async function queryHotels(sdkClient, accessToken, accountId, pageSize) {
  const hotels = [];
  let pageIndex = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await sdkClient.hotelPoiQuery(new DouyinOpenApiSdk.HotelPoiQueryRequest({
      accessToken,
      accountId,
      pageIndex,
      pageSize
    }));

    const currentHotels = Array.isArray(response?.data?.hotelList)
      ? response.data.hotelList
      : [];
    hotels.push(...currentHotels);

    const pagination = response?.data?.pagination || {};
    hasMore = Boolean(pagination.hasMore);
    pageIndex += 1;
  }

  return hotels;
}

/**
 * 按酒店查询物理房型列表。
 * @param {object} sdkClient SDK 客户端
 * @param {string} accessToken 调用 token
 * @param {string} accountId 抖音业务账号 ID
 * @param {string[]} poiIds 酒店 ID 列表
 * @returns {Promise<object[]>} 房型基础列表
 * @throws {Error} 查询失败时抛出异常
 */
async function searchRoomsByPoiIds(sdkClient, accessToken, accountId, poiIds) {
  if (!poiIds.length) {
    return [];
  }

  const response = await callRawOpenApi(
    sdkClient,
    accessToken,
    '/goodlife/v1/trip/physical_room/search/',
    {
      account_id: accountId,
      poi_ids: poiIds
    }
  );

  const roomLists = response?.data?.roomLists || response?.data?.room_lists || {};
  return Object.entries(roomLists).flatMap(([poiId, roomItems]) => (
    Array.isArray(roomItems)
      ? roomItems.map((roomItem) => ({
        poiId,
        ...roomItem
      }))
      : []
  ));
}

/**
 * 按 roomId 查询物理房型详情及价格计划。
 * @param {object} sdkClient SDK 客户端
 * @param {string} accessToken 调用 token
 * @param {string} accountId 抖音业务账号 ID
 * @param {string[]} roomIds 指定房型 ID 列表
 * @returns {Promise<object[]>} 房型详情列表
 * @throws {Error} 查询失败时抛出异常
 */
async function queryRooms(sdkClient, accessToken, accountId, roomIds) {
  if (!roomIds.length) {
    return [];
  }

  const response = await callRawOpenApi(
    sdkClient,
    accessToken,
    '/goodlife/v1/trip/physical_room/query/',
    {
      account_id: accountId,
      need_rate_plan: true,
      room_ids: roomIds
    }
  );

  return Array.isArray(response?.data?.roomList || response?.data?.room_list)
    ? (response.data.roomList || response.data.room_list)
    : [];
}

/**
 * 组装系统侧账号配置模板。
 * @param {object} options 脚本参数
 * @param {object[]} hotels 酒店列表
 * @returns {object} 账号配置模板
 * @throws {Error} 无
 */
function buildAccountTemplate(options, hotels) {
  return {
    accountCode: 'default',
    clientKey: '请填写抖音推单给你的 clientKey',
    inboundSecret: '请填写抖音推单签名 secret',
    appId: options.appId || '请填写开放平台 appId',
    appSecret: options.appSecret ? '***已提供***' : '请填写开放平台 appSecret',
    accountId: options.accountId,
    hotelId: hotels[0]?.hotelId || '请从 hotels 列表中选择 hotelId',
    accessToken: options.accessToken ? '***已提供***' : '',
    enabled: true,
    mockMode: 'none'
  };
}

/**
 * 组装房型映射模板。
 * @param {object[]} rooms 房型列表
 * @returns {object[]} 映射模板列表
 * @throws {Error} 无
 */
function buildRoomMappingTemplates(rooms) {
  return rooms.map((room) => ({
    localRoomType: '请替换为你系统里的 room_types.type_code',
    douyinRoomId: room.roomId,
    douyinRatePlanId: Array.isArray(room.ratePlanList) && room.ratePlanList.length
      ? room.ratePlanList[0].ratePlanId
      : '',
    syncInventory: true,
    syncPrice: true,
    enabled: true,
    roomName: room.cnName,
    ratePlans: Array.isArray(room.ratePlanList)
      ? room.ratePlanList.map((ratePlan) => ({
        ratePlanId: ratePlan.ratePlanId,
        ratePlanName: ratePlan.ratePlanName,
        status: ratePlan.status
      }))
      : []
  }));
}

/**
 * 以更易读的结构输出查询结果。
 * @param {object} output 输出对象
 * @returns {void}
 * @throws {Error} 无
 */
function printResult(output) {
  console.log(JSON.stringify(output, null, 2));
}

/**
 * 输出脚本使用说明。
 * @returns {void}
 * @throws {Error} 无
 */
function printUsage() {
  console.log([
    '用法示例：',
    'npm --workspace backend exec -- node scripts/queryDouyinHotelParams.js --appId=你的AppId --appSecret=你的AppSecret --accountId=你的AccountId',
    '可选参数：',
    '--accessToken=手工token',
    '--pageSize=50',
    '--roomIds=room1,room2'
  ].join('\n'));
}

/**
 * 主执行流程。
 * @returns {Promise<void>} 执行结果
 * @throws {Error} 查询失败时抛出异常
 */
async function main() {
  const cliArgs = parseCliArgs();
  if (readBooleanOption(cliArgs, 'help', false)) {
    printUsage();
    return;
  }

  const options = {
    appId: readStringOption(cliArgs, ['appId', 'app_id']),
    appSecret: readStringOption(cliArgs, ['appSecret', 'app_secret']),
    accountId: readStringOption(cliArgs, ['accountId', 'account_id']),
    accessToken: readStringOption(cliArgs, ['accessToken', 'access_token']),
    pageSize: readNumberOption(cliArgs, 'pageSize', 50),
    roomIds: readRoomIds(cliArgs)
  };

  validateOptions(options);

  const sdkClient = createSdkClient();
  const accessToken = await resolveAccessToken(options);
  const hotels = await queryHotels(sdkClient, accessToken, options.accountId, options.pageSize);
  const poiIds = hotels.map((hotel) => String(hotel.hotelId || '').trim()).filter(Boolean);
  const searchedRooms = options.roomIds.length
    ? []
    : await searchRoomsByPoiIds(sdkClient, accessToken, options.accountId, poiIds);
  const roomIds = options.roomIds.length
    ? options.roomIds
    : searchedRooms.map((room) => String(room.roomId || room.room_id || '').trim()).filter(Boolean);
  const roomDetails = await queryRooms(sdkClient, accessToken, options.accountId, roomIds);
  const roomDetailMap = new Map(
    roomDetails.map((room) => [String(room.roomId || room.room_id || ''), room])
  );
  const rooms = options.roomIds.length
    ? roomDetails
    : searchedRooms.map((room) => {
      const roomId = String(room.roomId || room.room_id || '');
      const detail = roomDetailMap.get(roomId) || {};
      return {
        ...room,
        ...detail,
        roomId
      };
    });

  printResult({
    input: {
      accountId: options.accountId,
      appId: options.appId || '',
      useManualAccessToken: Boolean(options.accessToken),
      roomIdsFilter: options.roomIds,
      discoveredPoiIds: poiIds
    },
    hotels: hotels.map((hotel) => ({
      hotelId: hotel.hotelId,
      hotelName: hotel.hotelName,
      accountId: hotel.accountId || options.accountId,
      address: hotel.address || {}
    })),
    rooms: rooms.map((room) => ({
      roomId: room.roomId || room.room_id || '',
      roomName: room.cnName || room.cn_name || '',
      status: room.status,
      ratePlanList: Array.isArray(room.ratePlanList || room.rate_plan_list)
        ? (room.ratePlanList || room.rate_plan_list).map((ratePlan) => ({
          ratePlanId: ratePlan.ratePlanId || ratePlan.rate_plan_id || '',
          ratePlanName: ratePlan.ratePlanName || ratePlan.rate_plan_name || '',
          status: ratePlan.status,
          ratePlanType: ratePlan.ratePlanType || ratePlan.rate_plan_type
        }))
        : []
    })),
    accountConfigTemplate: buildAccountTemplate(options, hotels),
    roomMappingTemplates: buildRoomMappingTemplates(rooms)
  });
}

main().catch((error) => {
  console.error('抖音参数查询失败:', error.message || error);
  process.exit(1);
});
