const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured');
}

// Vercel may freeze and resume a function between requests. A pool can discard
// stale Neon connections and establish a fresh one instead of hanging forever.
const pg = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  query_timeout: 30000,
  keepAlive: true,
  allowExitOnIdle: true,
});

pg.on('error', (error) => {
  console.error('Unexpected idle database connection error:', error.message);
});

pg.withTransaction = async (callback) => {
  const client = await pg.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Database rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
};

module.exports = pg;
