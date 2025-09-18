#!/usr/bin/env node

const { initializeHotelDB } = require('../database/postgreDB/pg');

(async () => {
  await initializeHotelDB();
  console.log('Database synced.');
})();
