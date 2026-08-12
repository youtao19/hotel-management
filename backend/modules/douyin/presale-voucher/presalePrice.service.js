"use strict";

const { syncDailyPrices } = require('../price-save/dailyPrice.service');

/** 推送预售券绑定预定商品的按日房价。 */
async function syncPresalePrices(ratePlanId, options = {}) {
  return syncDailyPrices(ratePlanId, options, {
    type: 'PRESALE',
    name: '预售券',
    priceName: '预售券按日价格',
    logType: 'presale_price_push'
  });
}

module.exports = { syncPresalePrices };
