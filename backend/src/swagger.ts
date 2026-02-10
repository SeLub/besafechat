// src/swagger.ts
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export async function registerSwagger(app: INestApplication) {
  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 4000);
  const useHttps = configService.get('HTTPS', 'true') === 'true';
  const protocol = useHttps ? 'https' : 'http';

  // Create servers for common environments
  const servers = [
    {
      url: `${protocol}://localhost:${port}`,
      description: 'Local development (localhost)',
    },
    {
      url: `${protocol}://127.0.0.1:${port}`,
      description: 'Local development (127.0.0.1)',
    },
    {
      url: `${protocol}://192.168.100.35:${port}`,
      description: 'Local network development',
    },
  ];

  const config = new DocumentBuilder()
    .setTitle('BeSafeChat API')
    .setDescription('E2EE Messenger API Documentation')
    .setVersion('1.0')
    .addSecurity('access-token-cookie', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'HttpOnly JWT access token (automatically set after login)',
    });

  servers.forEach((server) => config.addServer(server.url, server.description));

  const document = SwaggerModule.createDocument(app, config.build());
  SwaggerModule.setup('docs', app, document);

  console.log(`📘 Swagger UI available at:`);
  servers.forEach((server) => console.log(`    ${server.url}/docs - ${server.description}`));
}
