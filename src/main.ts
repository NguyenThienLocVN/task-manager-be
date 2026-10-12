import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app =
    await NestFactory.create(
      AppModule,
    );

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
    ],

    credentials: true,

    methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    ]
  });

  await app.listen(3001);
}

bootstrap();