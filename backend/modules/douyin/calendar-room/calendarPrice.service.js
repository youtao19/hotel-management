"use strict";

const { syncDailyPrices } = require('../price-save/dailyPrice.service');

/** 推送日历房套餐的按日房价。 */
async function syncCalendarPrices(ratePlanId, options = {}) {
  return syncDailyPrices(ratePlanId, options, {
    type: 'CALENDAR_ROOM',
    name: '日历房',
    priceName: '日历房价格',
    logType: 'calendar_price_push'
  });
}

module.exports = { syncCalendarPrices };
