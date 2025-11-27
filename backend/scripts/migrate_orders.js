const db = require('../database/postgreDB/pg');

async function migrate() {
    console.log('Starting migration...');
    db.createPool();
    const client = await db.getClient();
    try {
        console.log('Dropping orders table...');
        await client.query('DROP TABLE IF EXISTS orders CASCADE');
        console.log('Orders table dropped.');
    } catch (e) {
        console.error('Error dropping table:', e);
    } finally {
        client.release();
    }

    console.log('Initializing DB (recreating tables)...');
    await db.initializePostgreDB();
    console.log('Migration completed.');
    process.exit(0);
}

migrate();
