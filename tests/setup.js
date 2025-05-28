const db = require('../backend/database/postgreDB/pg');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await db.initializeHotelDB();
});

afterAll(async () => {
  await db.closePool();
});
