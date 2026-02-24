import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { handleShutdownSignals, handleUncaughtErrors } from './common/fatal';
import { PinoLogger } from './common/pino-logger.service';
import './env';
import { registerSwagger } from './swagger';

// В самом начале main.ts, после импортов
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨 CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Stack:', reason?.stack);

  // Don't exit the process for EADDRINUSE errors as they're recoverable
  if (reason?.code === 'EADDRINUSE') {
    console.warn('⚠️ Address in use, waiting for port to become available...');
  } else {
    process.exit(1);
  }
});

async function bootstrap() {
  handleUncaughtErrors();
  handleShutdownSignals();

  const useHttps = process.env.HTTPS === 'true';
  
  let httpsOptions: any = undefined;
  if (useHttps) {
    const certPath = path.join(process.cwd(), 'cert.crt');
    const keyPath = path.join(process.cwd(), 'cert.key');
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      httpsOptions = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      };
      console.log('✅ HTTPS enabled with certificates');
    } else {
      console.warn('⚠️ HTTPS enabled but certificates not found, falling back to HTTP');
      console.warn('   To generate certificates, run:');
      console.warn('   pnpm dlx mkcert create-ca');
      console.warn('   pnpm dlx mkcert create-cert --domains 192.168.100.35 localhost 127.0.0.1');
      httpsOptions = undefined;
    }
  }

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });

  const configService = app.get(ConfigService);

  app.useWebSocketAdapter(new IoAdapter(app));

  // Логгер
  app.useLogger(new PinoLogger());

  // CORS - получаем конфиг после инициализации ConfigModule
  const corsOrigins = (configService.get('CORS_ORIGINS') || 'https://localhost:5173,https://192.168.100.35:5173')
    .split(',')
    .map((origin: string) => origin.trim())
    .filter((origin: string) => origin.length > 0);

  console.log('CORS Origins configured:', corsOrigins);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
    optionsSuccessStatus: 200,
  });

  // Прочее
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Swagger
  await registerSwagger(app);

  const port = configService.get('PORT', 4000);

  // Graceful shutdown handling to prevent port conflicts during restarts
  let server: any;
  try {
    server = await app.listen(port, '0.0.0.0');
    console.log(`🚀 Server running on https://localhost:${port}`);
    console.log(`📘 Swagger UI: https://localhost:${port}/docs`);
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} is busy, waiting before retry...`);
      setTimeout(async () => {
        try {
          server = await app.listen(port, '0.0.0.0');
          console.log(`🚀 Server running on https://localhost:${port}`);
          console.log(`📘 Swagger UI: https://localhost:${port}/docs`);
        } catch (retryError: any) {
          console.error(`❌ Failed to start server after retry:`, retryError.message);
          process.exit(1);
        }
      }, 1000); // Wait 1 second before retrying
    } else {
      console.error('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  }

  // Handle uncaught errors and rejections specifically for this issue
  process.on('SIGTERM', async () => {
    console.info('SIGTERM signal received: closing HTTP server');
    if (server) {
      await app.close();
    }
    // Small delay to ensure port is released
    await new Promise((resolve) => setTimeout(resolve, 500));
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.info('SIGINT signal received: closing HTTP server');
    if (server) {
      await app.close();
    }
    // Small delay to ensure port is released
    await new Promise((resolve) => setTimeout(resolve, 500));
    process.exit(0);
  });
}

bootstrap();
