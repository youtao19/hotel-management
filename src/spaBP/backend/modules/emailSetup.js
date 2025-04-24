"use strict";
const setup = require("../../appSettings/setup.js") // 引入应用设置
const nodemailer = require("nodemailer"); // 引入 nodemailer 库用于发送邮件

// 创建邮件传输器实例
let emailTransport = nodemailer.createTransport({
  host: setup.email.host, // 邮件服务器主机地址
  port: setup.email.port, // 邮件服务器端口
  // 对于端口 587，secure 设置为 false；对于端口 465，设置为 true
  secure: false, // 是否使用 TLS 加密连接
  auth: { // 认证信息
    user: setup.email.user, // 邮箱用户名
    pass: setup.email.pw, // 邮箱密码或授权码
  },
});

// 测试邮件服务器连接
async function testConnection() {
  try {
    const result = await emailTransport.verify(); // 验证邮件传输器配置
    console.log(`邮件连接已准备就绪！ ${result}`);
  } catch (error) {
    console.log(`邮件 SMTP 连接未准备就绪，错误： ${error}`);
  }
};

// 发送重设密码邮件
async function sendResetPWEmail(code, to, lan) {
  const link = setup.appUrl + "/reset-pw/" + code; // 构造重设密码链接
  let text;
  let subject;
  if (lan === "zh-Hans") { // 根据语言选择邮件内容
    text = `请点击链接来重设密码：${link} \n链接有效时间为1个小时.`;
    subject = `${setup.appName} 重设密码`
  } else {
    text = `please follow the link to reset the password : ${link} \nThe link is valid for 1 hour!`;
    subject = `${setup.appName} password reset`
  }
  const message = {
    from: `support <${setup.adminEmail}>`, // 发件人信息
    to, // 收件人地址
    subject, // 邮件主题
    text // 邮件正文
  };
  return await emailTransport.sendMail(message); // 发送邮件
}

// 发送邮箱验证邮件
async function sendEmailVerification(code, to, lan) {
  const link = setup.appUrl + "/verify-email/" + code; // 构造邮箱验证链接
  let text;
  let subject;
  if (lan === "zh-Hans") { // 根据语言选择邮件内容
    text = `请点击链接来验证邮箱地址，链接有效期为1小时: ${link}`;
    subject = `${setup.appName} 邮箱验证`
  } else {
    text = `please follow the link to verify your email: ${link} \nThe link is valid for 1 hour!`;
    subject = `${setup.appName} verify your email address`
  }
  const message = {
    from: `support <${setup.adminEmail}>`, // 发件人信息
    to, // 收件人地址
    subject, // 邮件主题
    text // 邮件正文
  };
  return await emailTransport.sendMail(message); // 发送邮件
}

// 邮件任务对象
const emailJob = {
  sendEmailVerification, // 发送邮箱验证邮件
  sendResetPWEmail, // 发送重设密码邮件
  testConnection // 测试邮件服务器连接
}

module.exports = emailJob; // 导出邮件任务对象