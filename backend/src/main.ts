import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { configurarApp } from './app.js';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = configurarApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
