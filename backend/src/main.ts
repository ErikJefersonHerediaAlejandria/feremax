import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { configurarApp } from './app.js';
import { AppModule } from './app.module.js';
import { Recommender } from './comun/recommender.client.js';

async function bootstrap() {
  const app = configurarApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
  // En planes que suspenden los servicios inactivos (Render gratis), el API despierta al recommender al arrancar
  // para que esté listo cuando lleguen las primeras recomendaciones.
  void app.get(Recommender).salud(90_000);
}
await bootstrap();
