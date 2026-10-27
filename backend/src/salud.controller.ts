import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from './comun/prisma.service.js';
import { Recommender } from './comun/recommender.client.js';

export const VERSION = '2.0.0';

@ApiTags('salud')
@Controller()
export class SaludController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommender: Recommender,
  ) {}

  @Get()
  raiz() {
    return { servicio: 'FerreMax API', version: VERSION, salud: '/api/health' };
  }

  /** 200 si la base responde (lo usa el health check de Render); informa además el estado del recommender. */
  @Get('api/health')
  async salud() {
    try {
      await this.prisma.$queryRaw`select 1`;
    } catch {
      throw new ServiceUnavailableException({
        detail: 'Base de datos no disponible',
      });
    }
    return {
      status: 'ok',
      version: VERSION,
      base_datos: 'ok',
      recommender: (await this.recommender.salud()) ? 'ok' : 'no disponible',
    };
  }
}
