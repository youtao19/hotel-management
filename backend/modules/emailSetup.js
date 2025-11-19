"use strict";
const setup = require("../appSettings/setup.js")
const nodemailer = require("nodemailer");

let emailTransport = nodemailer.createTransport({
  host: setup.email.host,
  port: setup.email.port,
  //for port 587, secure set to false, true for port 465
  secure: true,
  auth: {
    user: setup.email.user,
    pass: setup.email.pw,
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const result = await emailTransport.verify();
    console.log(`email connection is ready! ${result}`);
  } catch (error) {
    console.log(`email smtp connection is not ready with error ${error}`);
  }
};

async function sendResetPWEmail(code, to, lan) {
  const link = setup.appUrl + "/reset-pw/" + code;
  let text;
  let subject;
  if (lan === "zh-Hans") {
    text = `请点击链接来重设密码：${link} \n链接有效时间为1个小时.`;
    subject = `${setup.appName} 重设密码`
  } else {
    text = `please follow the link to reset the password : ${link} \nThe link is valid for 1 hour!`;
    subject = `${setup.appName} password reset`
  }
  const message = {
    from: `古城云阙酒店 <${setup.adminEmail}>`,
    to,
    subject,
    text
  };
  return await emailTransport.sendMail(message);
}

async function sendEmailVerification(code, to, lan) {
  const link = setup.appUrl + "/email-verify/" + code;
  let text;
  let subject;
  if (lan === "zh-Hans") {
    text = `请点击链接来验证邮箱地址，链接有效期为1小时: ${link}`;
    subject = `${setup.appName} 邮箱验证`
  } else {
    text = `please follow the link to verify your email: ${link} \nThe link is valid for 1 hour!`;
    subject = `${setup.appName} verify your email address`
  }
  const message = {
    from: `古城云阙酒店 <${setup.adminEmail}>`,
    to,
    subject,
    text
  };
  // console.log(message);

  return await emailTransport.sendMail(message);
}

function resolveRecipients(to) {
  if (Array.isArray(to)) {
    return to.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (typeof to === 'string') {
    return to
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}


/**
 * 发送系统邮件
 * @param {to: string|string[]} to - 收件人邮箱地址，支持逗号分隔的字符串或字符串数组
 * @param {string} subject - 邮件主题
 * @param {string} text - 邮件文本内容
 * @param {string} html - 邮件HTML内容
 * @returns {Promise} - 发送邮件的结果
 */
async function sendSystemEmail({ to, subject, text, html }) {
  const recipients = resolveRecipients(to && to.length ? to : [setup.adminEmail]);
  if (!recipients.length) {
    console.warn('[emailSetup] 无有效的收件人，取消发送系统邮件');
    return null;
  }

  const message = {
    from: `古城云阙酒店 <${setup.adminEmail}>`,
    to: recipients.join(','),
    subject: subject || `${setup.appName} 系统通知`,
    text: text || '',
    html
  };

  return await emailTransport.sendMail(message);
}

const emailJob = {
  sendEmailVerification,
  sendResetPWEmail,
  sendSystemEmail,
  testConnection
}

module.exports = emailJob;
