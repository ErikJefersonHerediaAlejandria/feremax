import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import type {
  Configuracion,
  SesionEvaluacion,
} from '../generated/prisma/client.js';
import { ContextoService } from '../comun/contexto.service.js';
import { PrismaService } from '../comun/prisma.service.js';
import { Recommender } from '../comun/recommender.client.js';
import {
  AdminGuard,
  AuthService,
  COOKIE_ADMIN,
  opcionesCookie,
  type Admin,
} from './auth.js';
import {
  ConfiguracionDto,
  EventosQuery,
  FinalizarSesionDto,
  IniciarSesionDto,
  LoginDto,
  ReglasQuery,
} from './dto.js';
import { IndicadoresService } from './indicadores.service.js';

const limiteLogin = () => Number(process.env.THROTTLE_LOGIN ?? 5);

function configCompleta(c: Configuracion) {
  return {
    id: c.id,
    modo_activo: c.modo_activo,
    k: c.k,
    soporte_min: c.soporte_min,
    confianza_min: c.confianza_min,
    lift_min: c.lift_min,
    peso_contenido: c.peso_contenido,
    variante_ml: c.variante_ml,
    fuente_datos: c.fuente_datos,
    reordenador: c.reordenador,
  };
}

function sesionV1(s: SesionEvaluacion) {
  const { token_dispositivo: _token, ...resto } = s;
  return resto;
}

@ApiTags('admin')
@Controller('api/admin')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: limiteLogin, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.auth.login(dto.username, dto.password);
    res.cookie(COOKIE_ADMIN, token, opcionesCookie());
    // `token` se mantiene por compatibilidad con v1; el panel v2 usa solo la cookie httpOnly.
    return { token };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge: _maxAge, ...opciones } = opcionesCookie();
    res.clearCookie(COOKIE_ADMIN, opciones);
    return { status: 'ok' };
  }

  @Get('verificar')
  @UseGuards(AdminGuard)
  verificar(@Req() req: Request & { admin: Admin }) {
    return { valido: true, username: req.admin.username };
  }
}

@ApiTags('admin')
@Controller('api/admin')
export class ConfigController {
  private readonly log = new Logger('Config');

  constructor(
    private readonly auth: AuthService,
    private readonly contexto: ContextoService,
    private readonly prisma: PrismaService,
    private readonly recommender: Recommender,
  ) {}

  /** Público: solo lo que necesita la tienda (sin la condición experimental). Con sesión de admin: todo. */
  @Get('config')
  async config(@Req() req: Request) {
    const c = await this.contexto.configuracion();
    if (await this.auth.desde(req)) return configCompleta(c);
    return { k: c.k, fuente_datos: c.fuente_datos };
  }

  @Put('config')
  @UseGuards(AdminGuard)
  async actualizar(@Body() dto: ConfiguracionDto) {
    await this.contexto.configuracion();
    const c = await this.prisma.configuracion.update({
      where: { id: 1 },
      data: {
        modo_activo: dto.modo_activo,
        k: dto.k,
        soporte_min: dto.soporte_min,
        confianza_min: dto.confianza_min,
        lift_min: dto.lift_min,
        peso_contenido: dto.peso_contenido,
        variante_ml: dto.variante_ml ?? undefined,
      },
    });
    this.recommender
      .recargar()
      .catch((e: Error) =>
        this.log.warn(`No se pudo recargar el recommender: ${e.message}`),
      );
    return configCompleta(c);
  }
}

@ApiTags('admin')
@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: ContextoService,
    private readonly recommender: Recommender,
    private readonly indicadores: IndicadoresService,
  ) {}

  /** Reglas del modelo vigente ordenadas por confianza × lift; `vigentes=true` aplica los umbrales actuales. */
  @Get('reglas')
  async reglas(@Query() q: ReglasQuery) {
    const c = await this.contexto.configuracion();
    const reglas = await this.prisma.reglaAsociacion.findMany({
      where: {
        vigente: true,
        ...(q.vigentes
          ? {
              soporte: { gte: c.soporte_min },
              confianza: { gte: c.confianza_min },
              lift: { gte: c.lift_min },
            }
          : {}),
      },
    });
    return reglas
      .sort(
        (a, b) => b.confianza * b.lift - a.confianza * a.lift || a.id - b.id,
      )
      .map((r) => ({
        id: r.id,
        antecedentes: JSON.stringify(r.antecedente),
        consecuentes: JSON.stringify(r.consecuente),
        soporte: r.soporte,
        confianza: r.confianza,
        lift: r.lift,
        version_modelo: r.version_modelo,
      }));
  }

  @Post('modelo/reentrenar')
  @HttpCode(200)
  reentrenar() {
    return this.recommender.reentrenar();
  }

  @Get('sesiones')
  async sesiones() {
    const s = await this.prisma.sesionEvaluacion.findMany({
      orderBy: { inicio: 'desc' },
    });
    return s.map(sesionV1);
  }

  /** Inicia una sesión de evaluación y fija el modo activo del recomendador en su condición. */
  @Post('sesiones')
  @HttpCode(200)
  async iniciarSesion(@Body() dto: IniciarSesionDto) {
    const activa = await this.prisma.sesionEvaluacion.findFirst({
      where: { fin: null },
    });
    if (activa)
      throw new ConflictException({
        detail: `Ya hay una sesión activa (${activa.id_sesion}). Finalízala antes de iniciar otra.`,
      });
    const n = await this.prisma.sesionEvaluacion.count();
    const id_sesion =
      dto.id_sesion?.trim() || `SES-${String(n + 1).padStart(4, '0')}`;
    if (
      await this.prisma.sesionEvaluacion.findUnique({ where: { id_sesion } })
    ) {
      throw new ConflictException({
        detail: `Ya existe la sesión ${id_sesion}`,
      });
    }
    const token = randomBytes(24).toString('base64url');
    const [sesion] = await this.prisma.$transaction([
      this.prisma.sesionEvaluacion.create({
        data: {
          id_sesion,
          codigo_cliente: dto.codigo_cliente,
          escenario: dto.escenario,
          condicion: dto.condicion,
          orden: dto.orden,
          token_dispositivo: token,
        },
      }),
      this.prisma.configuracion.update({
        where: { id: 1 },
        data: { modo_activo: dto.condicion },
      }),
    ]);
    return { sesion: sesionV1(sesion), token_dispositivo: token };
  }

  @Put('sesiones')
  async finalizarSesion(@Body() dto: FinalizarSesionDto) {
    const s = await this.prisma.sesionEvaluacion.findUnique({
      where: { id_sesion: dto.id_sesion },
    });
    if (!s) throw new NotFoundException({ detail: 'Sesión no encontrada' });
    const confirmo =
      (await this.prisma.pedido.count({ where: { id_sesion: s.id_sesion } })) >
      0;
    const sesion = await this.prisma.sesionEvaluacion.update({
      where: { id_sesion: s.id_sesion },
      data: {
        fin: s.fin ?? new Date(),
        valida: dto.valida ?? true,
        completa: confirmo,
      },
    });
    return sesionV1(sesion);
  }

  @Get('eventos')
  async eventos(@Query() q: EventosQuery) {
    const eventos = await this.prisma.evento.findMany({
      where: {
        id_sesion: q.id_sesion,
        codigo_cliente: q.codigo_cliente,
        condicion: q.condicion,
        tipo_evento: q.tipo_evento,
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: q.limite ?? 5000,
    });
    return eventos.map(({ id, timestamp, recibido_en: _r, ...e }) => ({
      id_evento: Number(id),
      ...e,
      timestamp: Number(timestamp),
    }));
  }

  @Get('indicadores')
  indicadoresExperimento() {
    return this.indicadores.calcular();
  }

  @Get('dashboard')
  dashboard() {
    return this.indicadores.dashboard();
  }

  /** Último resumen de evaluación offline, o `null` si aún no se ha corrido. */
  @Get('evaluacion-offline')
  async ultimaEvaluacion(@Res() res: Response) {
    const e = await this.prisma.evaluacionOffline.findFirst({
      orderBy: { fecha: 'desc' },
    });
    res.json(e?.resultado ?? null);
  }

  @Post('evaluacion-offline')
  @HttpCode(200)
  evaluar() {
    return this.recommender.evaluacionOffline();
  }
}
