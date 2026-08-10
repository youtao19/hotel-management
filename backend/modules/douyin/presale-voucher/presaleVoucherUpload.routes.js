"use strict";

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const router = express.Router();
const uploadDirectory = path.join(__dirname, 'uploads');
const allowedImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

/** 返回可被抖音访问的图片公网根地址，拒绝本地地址避免写入无效券面图。 */
function getPublicBaseUrl() {
  const appUrl = String(process.env.APP_URL || '').replace(/\/+$/, '');
  let url;
  try {
    url = new URL(appUrl);
  } catch (_) {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    return null;
  }
  return appUrl;
}

/** 保存允许的券面图类型，并使用服务端文件名隔离用户提供的原始名称。 */
const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
    callback(null, uploadDirectory);
  },
  filename(_req, file, callback) {
    callback(null, `${crypto.randomUUID()}${allowedImageTypes.get(file.mimetype)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 9 },
  fileFilter(_req, file, callback) {
    if (!allowedImageTypes.has(file.mimetype)) {
      return callback(new Error('仅支持 JPG、PNG 或 WebP 图片'));
    }
    return callback(null, true);
  }
});

/** 将员工选择的本地券面图片保存为可经 ngrok 访问的公网链接。 */
router.post('/images', (req, res) => {
  const publicBaseUrl = getPublicBaseUrl();
  if (!publicBaseUrl) {
    return res.status(400).json({ message: '请将 APP_URL 配置为 ngrok 提供的公网 http/https 地址后再上传图片' });
  }
  upload.array('images', 9)(req, res, error => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? '单张图片不能超过 5MB'
        : error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT'
          ? '一次最多上传 9 张图片'
          : error.message || '图片上传失败';
      return res.status(400).json({ message });
    }
    if (!req.files?.length) return res.status(400).json({ message: '请至少选择一张图片' });
    const urls = req.files.map(file => `${publicBaseUrl}/uploads/presale-vouchers/${file.filename}`);
    return res.status(201).json({ data: urls, message: '图片上传成功' });
  });
});

module.exports = { router, uploadDirectory };
