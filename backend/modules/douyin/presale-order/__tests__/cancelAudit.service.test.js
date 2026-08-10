jest.mock('../../../../database/postgreDB/pg', () => ({
  getClient: jest.fn(),
  query: jest.fn()
}));

jest.mock('../../../../appSettings/douyin.config', () => ({
  douyinConfig: {
    accountId: 'DY_ACCOUNT_TEST',
    openApiBaseUrl: 'https://open.douyin.test'
  }
}));

jest.mock('../../token/token.service', () => ({
  getToken: jest.fn()
}));

jest.mock('../cancelAudit.repository', () => ({
  findByCancelId: jest.fn(),
  insertPending: jest.fn(),
  listAudits: jest.fn(),
  markCallbackPending: jest.fn(),
  markCallbackSucceeded: jest.fn(),
  markCallbackFailed: jest.fn()
}));

jest.mock('../presaleOrder.repository', () => ({
  findByDouyinOrderId: jest.fn(),
  findByLocalOrderId: jest.fn(),
  markCancelled: jest.fn(),
  markRefundPending: jest.fn()
}));

jest.mock('../bookingOrder.repository', () => ({
  findByDouyinOrderId: jest.fn(),
  findByLocalOrderId: jest.fn(),
  markCancelled: jest.fn()
}));

const { getClient } = require('../../../../database/postgreDB/pg');
const cancelAuditRepository = require('../cancelAudit.repository');
const presaleOrderRepository = require('../presaleOrder.repository');

const {
  AUDIT_ENDPOINT,
  callbackDouyinAudit,
  normalizeCancelAuditRequest,
  reviewCancelAudit
} = require('../cancelAudit.service');

describe('抖音预售券取消人工审核', () => {
  /** 构造已由员工提交结论的取消审核记录。 */
  function buildAudit(overrides = {}) {
    return {
      cancel_id: 'DY_CANCEL_AUDIT_001',
      biz_type: 2011,
      audit_result: 2,
      cancel_type: 2,
      ota_order_id: 'DY_ORDER_001',
      audit_reason: '超过可取消时间',
      ...overrides
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('回传审核结论时使用官方 cancel_Id 字段并保留抖音 logid', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({
        extra: { error_code: 0, logid: 'DY_AUDIT_CALLBACK_LOG_001' },
        data: { error_code: 0 }
      })
    });
    const tokenService = { getToken: jest.fn().mockResolvedValue('token-test') };

    const result = await callbackDouyinAudit(buildAudit(), { fetchImpl, tokenService });

    expect(fetchImpl).toHaveBeenCalledWith(`https://open.douyin.test${AUDIT_ENDPOINT}`, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'access-token': 'token-test',
        'Rpc-Transit-Life-Account': 'DY_ACCOUNT_TEST'
      }),
      body: JSON.stringify({
        cancel_Id: 'DY_CANCEL_AUDIT_001',
        cancel_result: 2,
        cancel_type: 2,
        order_id: 'DY_ORDER_001',
        reason: '超过可取消时间'
      })
    }));
    expect(result.logId).toBe('DY_AUDIT_CALLBACK_LOG_001');
  });

  test('预售券主订单拒绝仅取消预约的无效售后类型', () => {
    expect(() => normalizeCancelAuditRequest({
      cancel_id: 'DY_CANCEL_AUDIT_002',
      order_id: 'DY_ORDER_002',
      biz_type: 2011,
      cancel_type: 2,
      after_sale_type: 2,
      refund_type: 11
    })).toThrow('预售券主订单不支持仅取消预约');
  });

  test('同意审核在抖音回传成功后才取消本地预售券订单', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    const audit = buildAudit({
      audit_result: 1,
      after_sale_type: 1,
      request_log_id: 'DY_SPI_CANCEL_AUDIT_LOG_003',
      request_payload: { cancel_id: 'DY_CANCEL_AUDIT_001' }
    });
    getClient.mockResolvedValue(client);
    cancelAuditRepository.markCallbackPending.mockResolvedValue(audit);
    cancelAuditRepository.markCallbackSucceeded.mockResolvedValue({ ...audit, audit_status: 'APPROVED', callback_log_id: 'DY_AUDIT_CALLBACK_LOG_003' });
    presaleOrderRepository.findByDouyinOrderId.mockResolvedValue({ id: 9, order_stage: 'PAID' });
    const fetchImpl = jest.fn().mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({ extra: { error_code: 0, logid: 'DY_AUDIT_CALLBACK_LOG_003' }, data: { error_code: 0 } })
    });

    const result = await reviewCancelAudit('DY_CANCEL_AUDIT_001', { cancelResult: 1 }, { id: 7, name: '审核员' }, {
      fetchImpl,
      tokenService: { getToken: jest.fn().mockResolvedValue('token-test') }
    });

    expect(presaleOrderRepository.markCancelled).toHaveBeenCalledWith(
      9,
      { cancelId: 'DY_CANCEL_AUDIT_001' },
      audit.request_payload,
      'DY_SPI_CANCEL_AUDIT_LOG_003',
      client
    );
    expect(cancelAuditRepository.markCallbackSucceeded).toHaveBeenCalledWith(
      'DY_CANCEL_AUDIT_001',
      expect.objectContaining({ extra: expect.objectContaining({ logid: 'DY_AUDIT_CALLBACK_LOG_003' }) }),
      'DY_AUDIT_CALLBACK_LOG_003',
      client
    );
    expect(result.audit.audit_status).toBe('APPROVED');
  });
});
