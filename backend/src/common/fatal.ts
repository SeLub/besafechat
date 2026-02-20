import { logger } from './logger';
import { closeDB } from '../db/connection';

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    await closeDB();
    logger.info('Database connection closed.');
  } catch (err) {
    logger.error({ err }, 'Error closing DB:');
  }
  process.exit(0);
};

export const handleUncaughtErrors = () => {
  process.on('unhandledRejection', (reason: unknown) => {
    // Don't exit on EADDRINUSE errors as they're handled elsewhere
    const reasonObj = reason as Record<string, unknown> | null;
    if (reasonObj?.code === 'EADDRINUSE') {
      logger.warn({ reason }, 'Port already in use, will retry...');
    } else {
      logger.error({ reason }, 'Unhandled Rejection:');
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    // Check if the error object has a 'code' property and if it's EADDRINUSE
    const errorCode = (error as unknown as Record<string, unknown>).code;
    if (errorCode === 'EADDRINUSE') {
      logger.warn({ error }, 'Port already in use, will retry...');
    } else {
      logger.error({ error }, 'Uncaught Exception:');
      process.exit(1);
    }
  });
};

export const handleShutdownSignals = () => {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};
