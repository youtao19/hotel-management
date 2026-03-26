jest.mock('../../../../appSettings/douyin.config', () => ({
  douyinConfig: {
    accountId: 'ACC_001',
  },
}))

const { requestDouyinOpenApi } = require('../../clients/douyinOpenApi.client')
const {
  assertHotelInfoQueryResult,
  normalizeHotelInfoQueryParams,
  queryDouyinHotelInfo,
  syncDouyinHotelInfo,
} = require('../hotelInfoFetch.service')

jest.mock('../../clients/douyinOpenApi.client', () => ({
  requestDouyinOpenApi: jest.fn(),
}))

describe('hotelInfoFetch.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('normalizeHotelInfoQueryParams 应回退默认 accountId 并规范分页参数', () => {
    expect(normalizeHotelInfoQueryParams({
      pageIndex: 2,
      pageSize: 30,
    })).toEqual({
      accountId: 'ACC_001',
      pageIndex: 2,
      pageSize: 30,
    })
  })

  test('queryDouyinHotelInfo 应调用酒店自助匹配查询接口', async () => {
    requestDouyinOpenApi.mockResolvedValue({
      data: {
        error_code: 0,
        hotel_list: [{
          hotel_id: 'HOTEL_001',
          hotel_name: '测试酒店',
        }],
        pagination: {
          page_index: 1,
          page_size: 20,
          has_more: false,
        },
      },
      extra: {
        error_code: 0,
      },
    })

    const result = await queryDouyinHotelInfo({
      accountId: 'ACC_001',
      pageIndex: 1,
      pageSize: 20,
    })

    expect(requestDouyinOpenApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/goodlife/v1/trip/hotel/poi/query/',
      withAccountId: false,
      data: {
        account_id: 'ACC_001',
        page_index: 1,
        page_size: 20,
      },
    })
    expect(result.hotelList).toHaveLength(1)
    expect(result.pagination.has_more).toBe(false)
  })

  test('assertHotelInfoQueryResult 应在抖音返回错误时抛出业务异常', () => {
    expect(() => assertHotelInfoQueryResult({
      data: {
        error_code: 2100005,
        description: '参数不合法',
      },
    })).toThrow('参数不合法')
  })

  test('syncDouyinHotelInfo 应根据 has_more 继续翻页', async () => {
    requestDouyinOpenApi
      .mockResolvedValueOnce({
        data: {
          error_code: 0,
          hotel_list: [{
            hotel_id: 'HOTEL_001',
          }],
          pagination: {
            page_index: 1,
            page_size: 50,
            has_more: true,
          },
        },
        extra: {
          error_code: 0,
        },
      })
      .mockResolvedValueOnce({
        data: {
          error_code: 0,
          hotel_list: [{
            hotel_id: 'HOTEL_002',
          }],
          pagination: {
            page_index: 2,
            page_size: 50,
            has_more: false,
          },
        },
        extra: {
          error_code: 0,
        },
      })

    const result = await syncDouyinHotelInfo({
      accountId: 'ACC_001',
      pageSize: 50,
      startPageIndex: 1,
      maxPages: 10,
    })

    expect(result.summary.fetchedPages).toBe(2)
    expect(result.summary.fetchedHotels).toBe(2)
    expect(result.hotels.map((item) => item.hotel_id)).toEqual(['HOTEL_001', 'HOTEL_002'])
  })
})
