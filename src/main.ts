import { NestFactory } from '@nestjs/core';
import {
  ConsoleLogger,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';

export const modifyApp = (app: INestApplication) => {
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const apiPrefix = 'api';
  const apiVersion = 'v1';
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  return app;
};

async function bootstrap() {
  const app = modifyApp(
    await NestFactory.create(AppModule, {
      logger: new ConsoleLogger({ prefix: 'Tea Challenge' }),
    }),
  );

  if (process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('Tea Challenge Backend API')
      .setDescription(
        'NestJS-based relevance feed backend API with user authentication',
      )
      .setVersion('1.0')
      .addTag('Feed', 'Relevance-ranked post feed endpoints')
      .addTag('Posts', 'Post creation and management')
      .addTag('Health', 'Service health monitoring')
      .addTag('Admin', 'Administrative operations')
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-User-Id',
          in: 'header',
          description: 'User identifier (UUID v7 format)',
        },
        'X-User-Id',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || process.env.API_PORT || 3000;

  // Listen on all interfaces for Docker compatibility
  // Choose random port for e2e tests with Supertest
  await app.listen(process.env.NODE_ENV === 'test' ? 0 : port, '0.0.0.0');

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  console.log('\n📍 Services available at:');
  console.log(`   • API: http://localhost:${port}/api/v1`);
  console.log(`   • Health Check: http://localhost:${port}/api/v1/health`);

  if (process.env.NODE_ENV === 'development') {
    console.log(`   • API Documentation: http://localhost:${port}/docs`);
    console.log('\n🔧 Management Tools:');
    console.log('   • Mongo Express: http://localhost:8081 (U:admin P:pass)');
    console.log('   • Redis Commander: http://localhost:8082');
  }
}

bootstrap().catch((error) => {
  console.error('❌ Error starting application:', error);
  process.exit(1);
});
