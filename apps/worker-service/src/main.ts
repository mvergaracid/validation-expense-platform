/// <reference types="node" />
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { createWorkerMicroserviceOptions } from './messaging/transport.factory';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    createWorkerMicroserviceOptions(),
  );
  await app.listen();
}

bootstrap();
