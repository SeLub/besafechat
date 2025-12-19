import { Pool } from 'pg';
import { logger } from '../common/logger';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT as string, 10) || 5433,
  user: process.env.DB_USERNAME || 'user',
  password: process.env.DB_PASSWORD || 'secure_password',
  database: process.env.DB_DATABASE || 'messenger',
});

export const connectDB = async () => {
  try {
    await pool.query('SELECT 1');
    logger.info('✅ PostgreSQL connected');
  } catch (err) {
    logger.error({ err }, '❌ PostgreSQL connection failed:');
    throw err;
  }
};

export const closeDB = async () => {
  await pool.end();
};

export { pool };