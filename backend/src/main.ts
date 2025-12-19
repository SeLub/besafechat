import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { handleUncaughtErrors, handleShutdownSignals } from './common/fatal';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from './common/pino-logger.service';
import { registerSwagger } from './swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';

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

  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new IoAdapter(app));

  // Логгер
  app.useLogger(new PinoLogger());

  // CORS из конфига
  const configService = app.get(ConfigService);
  app.enableCors(AppModule.configureCors(configService));

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
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📘 Swagger UI: http://localhost:${port}/docs`);
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} is busy, waiting before retry...`);
      setTimeout(async () => {
        try {
          server = await app.listen(port, '0.0.0.0');
          console.log(`🚀 Server running on port ${port}`);
          console.log(`📘 Swagger UI: http://localhost:${port}/docs`);
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
    await new Promise(resolve => setTimeout(resolve, 500));
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.info('SIGINT signal received: closing HTTP server');
    if (server) {
      await app.close();
    }
    // Small delay to ensure port is released
    await new Promise(resolve => setTimeout(resolve, 500));
    process.exit(0);
  });
}

bootstrap();
