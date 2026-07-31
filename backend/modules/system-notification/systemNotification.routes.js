const express = require('express');
const service = require('./systemNotification.service');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const data = await service.getNotifications();
    return res.status(200).json({ data });
  } catch (error) {
    console.error('获取系统通知失败:', error);
    return res.status(500).json({ message: '获取系统通知失败' });
  }
});

router.patch('/read-all', async (_req, res) => {
  try {
    await service.markAllAsRead();
    return res.status(200).json({ message: '系统通知已标记为已读' });
  } catch (error) {
    console.error('标记系统通知已读失败:', error);
    return res.status(500).json({ message: '标记系统通知已读失败' });
  }
});

module.exports = router;
