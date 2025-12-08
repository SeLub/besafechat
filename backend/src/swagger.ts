// src/swagger.ts
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export async function registerSwagger(app: INestApplication) {
  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 4000);
  const host = 'localhost'; // или configService.get('HOST', 'localhost')
  const serverUrl = `http://${host}:${port}`;

  const config = new DocumentBuilder()
    .setTitle('BeSafeChat API')
    .setDescription('E2EE Messenger API Documentation')
    .setVersion('1.0')
    .addSecurity('access-token-cookie', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'HttpOnly JWT access token (automatically set after login)',
    })
    .addServer(serverUrl, 'Local development')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  console.log(`📘 Swagger UI: ${serverUrl}/docs`);
}
