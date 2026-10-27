import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { FiltroErrores, PipeValidacion } from './comun/errores.js';
import { CABECERA_SESION } from './comun/contexto.service.js';
import { VERSION } from './salud.controller.js';

/** Configuración común de la app (la usan `main.ts` y los tests e2e). */
export function configurarApp(app: INestApplication) {
  const express = app.getHttpAdapter().getInstance() as Express;
  express.set('trust proxy', 1); // detrás del proxy de Render: IP real para el rate limiting
  express.disable('x-powered-by');

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', CABECERA_SESION],
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  });
  app.useGlobalPipes(new PipeValidacion());
  app.useGlobalFilters(new FiltroErrores());

  if (process.env.NODE_ENV !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('FerreMax API v2')
      .setDescription('Contrato compatible con docs/openapi-v1.json')
      .setVersion(VERSION)
      .addCookieAuth('ferremax_admin')
      .build();
    SwaggerModule.setup('api/docs', app, () =>
      SwaggerModule.createDocument(app, doc),
    );
  }
  return app;
}
