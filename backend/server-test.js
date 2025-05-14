// backend/server-test.js

// 这个文件用于测试运行中的主服务器 server.js
// 在运行此脚本之前，请确保您的 server.js 已经在运行。

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 端口号, // !!! 请将这里的"端口号"替换为您的 server.js 实际监听的端口号 (通常在 appSettings/setup.js 中配置)
  path: '/api/health', // 测试的 API 端点
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers)}`);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('响应体:', data);
    // 您可以在这里添加断言来验证响应体的内容，例如使用 Node.js 的内置 'assert' 模块
    // const assert = require('assert');
    // try {
    //   const responseJson = JSON.parse(data);
    //   assert.strictEqual(res.statusCode, 200, '期望状态码为 200');
    //   assert.strictEqual(responseJson.status, 'ok', '期望响应状态为 ok');
    //   console.log('测试通过: /api/health 返回正常');
    // } catch (error) {
    //   console.error('测试失败:', error.message);
    // }
  });
});

req.on('error', (error) => {
  console.error(`请求出错: ${error.message}`);
  console.log('请确保您的 server.js 已经在运行，并且监听正确的端口。');
});

req.end();

// 您可以复制并修改上面的代码块来测试其他 API 端点

// 示例：测试 /api/room-types 端点 (GET 请求)
/*
const roomTypesOptions = {
  hostname: 'localhost',
  port: 端口号, // !!! 替换为您的端口号
  path: '/api/room-types',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
};

const roomTypesReq = http.request(roomTypesOptions, (res) => {
  console.log(`\n测试 /api/room-types`);
  console.log(`状态码: ${res.statusCode}`);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('响应体:', data);
    // 在这里添加断言来验证房型数据
  });
});

roomTypesReq.on('error', (error) => {
  console.error(`请求 /api/room-types 出错: ${error.message}`);
});

roomTypesReq.end();
*/
