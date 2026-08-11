jest.mock('../database/postgreDB/pg', () => ({
  ...jest.requireActual('../database/postgreDB/pg'),
  query: jest.fn()
}));

const db = require('../database/postgreDB/pg');
const repository = require('../modules/douyin/availability/availability.repository');

describe('抖音价量态套餐查询', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  /** 验证自动库存推送不会查询历史账号的套餐映射。 */
  test('按当前抖音账号筛选房型的已同步套餐', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await repository.findSyncedRatePlansByRoomType('bo_ye_shuang', 'CURRENT_ACCOUNT');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("ocm.channel_config ->> 'account_id' = $2"),
      ['bo_ye_shuang', 'CURRENT_ACCOUNT']
    );
  });
});
