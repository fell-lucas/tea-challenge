import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

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

  if (process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('Tea Challenge Backend API')
      .setDescription('NestJS-based relevance feed backend API')
      .setVersion('1.0')
      .addTag('tea-challenge')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || process.env.API_PORT || 3000;

  // Listen on all interfaces for Docker compatibility
  await app.listen(port, '0.0.0.0');

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
