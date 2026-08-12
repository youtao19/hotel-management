"use strict";

const { createDailyPriceRouter } = require('../price-save/dailyPrice.routes');
const { syncPresalePrices } = require('./presalePrice.service');

module.exports = createDailyPriceRouter({
  type: 'PRESALE',
  name: '预售券',
  syncPrices: syncPresalePrices
});
