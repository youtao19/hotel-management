"use strict";
const setup = require("../appSettings/setup.js")
const nodemailer = require("nodemailer");

let emailTransport = nodemailer.createTransport({
  host: setup.email.host,
  port: setup.email.port,
  //for port 587, secure set to false, true for port 465
  secure: false,
  auth: {
    user: setup.email.user,
    pass: setup.email.pw,
  },
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
    from: `support <${setup.adminEmail}>`,
    to,
    subject,
    text
  };
  return await emailTransport.sendMail(message);
}

async function sendEmailVerification(code, to, lan) {
  const link = setup.appUrl + "/verify-email/" + code;
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
    from: `support <${setup.adminEmail}>`,
    to,
    subject,
    text
  };
  return await emailTransport.sendMail(message);
}

const emailJob = {
  sendEmailVerification,
  sendResetPWEmail,
  testConnection
}

module.exports = emailJob;
