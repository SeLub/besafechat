import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

// Утилиты (опционально)
export const logError = (msg: string, err?: unknown) => logger.error({ err }, msg);
export const logInfo = (msg: string, meta?: unknown) => logger.info(meta, msg);
