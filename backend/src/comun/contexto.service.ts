import { Injectable } from '@nestjs/common';
import type {
  Configuracion,
  SesionEvaluacion,
} from '../generated/prisma/client.js';
import type { Modo } from '../generated/prisma/enums.js';
import { PrismaService } from './prisma.service.js';

export const CABECERA_SESION = 'x-sesion-evaluacion';

export interface Contexto {
  /** Sesión experimental activa vinculada a este navegador (por su token), o null. */
  sesion: SesionEvaluacion | null;
  /** Condición que decide el recomendador: la de la sesión, o `configuracion.modo_activo`. */
  condicion: Modo;
  config: Configuracion;
}

@Injectable()
export class ContextoService {
  constructor(private readonly prisma: PrismaService) {}

  async configuracion(): Promise<Configuracion> {
    const c = await this.prisma.configuracion.findUnique({ where: { id: 1 } });
    if (c) return c;
    return this.prisma.configuracion.create({ data: { id: 1 } });
  }

  /** Sesión activa (sin `fin`) cuyo token coincide con la cabecera x-sesion-evaluacion. */
  async sesionPorToken(
    token: string | undefined,
  ): Promise<SesionEvaluacion | null> {
    if (!token) return null;
    return this.prisma.sesionEvaluacion.findFirst({
      where: { token_dispositivo: token, fin: null },
    });
  }

  async resolver(token: string | undefined): Promise<Contexto> {
    const [config, sesion] = await Promise.all([
      this.configuracion(),
      this.sesionPorToken(token),
    ]);
    return {
      config,
      sesion,
      condicion: sesion?.condicion ?? config.modo_activo,
    };
  }
}
