"use strict";

const { createDailyPriceRouter } = require('../price-save/dailyPrice.routes');
const { syncCalendarPrices } = require('./calendarPrice.service');

module.exports = createDailyPriceRouter({
  type: 'CALENDAR_ROOM',
  name: '日历房',
  syncPrices: syncCalendarPrices
});
