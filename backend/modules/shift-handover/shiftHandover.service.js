"use strict";

const handoverModule = require("../handoverModule");
const repository = require("./shiftHandover.repository");

function resolveOperatorName({ handoverPerson, account }) {
  return handoverPerson
    || account?.username
    || account?.name
    || account?.email
    || "系统";
}

async function getOverview({ date, account }) {
  return handoverModule.getHandoverOverview({ date, account });
}

async function getTableData(date) {
  return handoverModule.getHandoverTableData(date);
}

async function getSpecialStats(date) {
  return repository.getSpecialStats(date);
}

async function getAdminMemos(date) {
  return handoverModule.getAdminMemosFromHandover(date);
}

async function listRecords() {
  return repository.listCompletedHandoverRecords();
}

async function completeHandover({ body, account }) {
  const {
    date,
    handoverPerson,
    receivePerson,
    retainedAmount,
    vipCard = 0,
    notes = ""
  } = body;
  const operatorName = resolveOperatorName({ handoverPerson, account });
  const overview = await handoverModule.getHandoverOverview({ date, account });
  const paymentData = handoverModule.recalculatePaymentData(overview.paymentData, { retainedAmount });

  const savedRecords = await repository.saveCompletedHandover({
    date,
    operatorName,
    receivePerson,
    vipCard,
    notes,
    paymentData
  });

  return {
    date,
    handoverPerson: operatorName,
    receivePerson: receivePerson.trim(),
    recordCount: savedRecords.length,
    records: savedRecords
  };
}

module.exports = {
  completeHandover,
  getAdminMemos,
  getOverview,
  getSpecialStats,
  getTableData,
  listRecords,
  resolveOperatorName
};
