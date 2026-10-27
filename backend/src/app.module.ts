import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  AdminController,
  AuthController,
  ConfigController,
} from './admin/admin.controller.js';
import { AdminGuard, AuthService, DURACION_SESION_S } from './admin/auth.js';
import { IndicadoresService } from './admin/indicadores.service.js';
import { ContextoService } from './comun/contexto.service.js';
import { PrismaService } from './comun/prisma.service.js';
import { Recommender, RecommenderHttp } from './comun/recommender.client.js';
import { RegistroMiddleware } from './comun/registro.middleware.js';
import { SaludController } from './salud.controller.js';
import { CatalogoService } from './tienda/catalogo.service.js';
import { ExperimentoController } from './tienda/experimento.controller.js';
import { TiendaController } from './tienda/tienda.controller.js';

function secretoJwt(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
    return 'solo-desarrollo-no-usar-en-produccion-0123456789';
  }
  return s;
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: secretoJwt(),
      signOptions: { expiresIn: DURACION_SESION_S },
    }),
    // Los límites concretos se fijan por ruta con @Throttle (solo escrituras públicas y login).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
  ],
  controllers: [
    SaludController,
    TiendaController,
    ExperimentoController,
    AuthController,
    ConfigController,
    AdminController,
  ],
  providers: [
    PrismaService,
    ContextoService,
    CatalogoService,
    AuthService,
    AdminGuard,
    IndicadoresService,
    { provide: Recommender, useClass: RecommenderHttp },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RegistroMiddleware).forRoutes('*path');
  }
}
