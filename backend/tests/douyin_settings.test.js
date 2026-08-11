jest.mock('../appSettings/douyin.config', () => ({
  douyinConfig: { autoConfirmEnabled: true }
}));

jest.mock('../modules/douyin/settings/douyinSettings.repository', () => ({
  findSettings: jest.fn(),
  saveAutoConfirmEnabled: jest.fn()
}));

const repository = require('../modules/douyin/settings/douyinSettings.repository');
const service = require('../modules/douyin/settings/douyinSettings.service');

describe('抖音支持设置', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('未保存设置时沿用部署默认的自动接单配置', async () => {
    repository.findSettings.mockResolvedValue(null);

    await expect(service.getSettings()).resolves.toMatchObject({ auto_confirm_enabled: true });
  });

  test('保存开关时记录当前员工账号', async () => {
    repository.saveAutoConfirmEnabled.mockResolvedValue({ auto_confirm_enabled: false });

    await expect(service.updateAutoConfirmEnabled(false, { id: 7 })).resolves.toEqual({ auto_confirm_enabled: false });
    expect(repository.saveAutoConfirmEnabled).toHaveBeenCalledWith(false, 7);
  });

  test('拒绝非布尔值开关', async () => {
    await expect(service.updateAutoConfirmEnabled('false', { id: 7 })).rejects.toMatchObject({ statusCode: 400 });
  });
});
