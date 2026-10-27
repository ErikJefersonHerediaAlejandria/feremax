import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { CABECERA_SESION, ContextoService } from '../comun/contexto.service.js';
import { redondear } from '../comun/formato.js';
import { PrismaService } from '../comun/prisma.service.js';
import { ConfirmarCarritoDto, EventoDto } from './dto.js';

/** Sin token de sesión válido, los eventos y pedidos no se asocian a ninguna sesión experimental. */
export const SIN_SESION = 'SIN-SESION';
const limite = (variable: string, porDefecto: number) => () =>
  Number(process.env[variable] ?? porDefecto);

@ApiTags('experimento')
@Controller('api')
export class ExperimentoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: ContextoService,
  ) {}

  /** Sesión en curso, solo para el navegador vinculado. Cualquier otro visitante recibe `null`. */
  @Get('sesiones/activa')
  @ApiHeader({ name: CABECERA_SESION, required: false })
  async activa(
    @Headers(CABECERA_SESION) token: string | undefined,
    @Res() res: Response,
  ) {
    const s = await this.contexto.sesionPorToken(token);
    // `res.json` explícito: Nest enviaría un cuerpo vacío para `null`, y v1 responde el literal `null`.
    res.json(
      s && {
        id_sesion: s.id_sesion,
        codigo_cliente: s.codigo_cliente,
        escenario: s.escenario,
        condicion: s.condicion,
        orden: s.orden,
        inicio: s.inicio,
      },
    );
  }

  @Post('eventos')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: limite('THROTTLE_EVENTOS', 600), ttl: 60_000 },
  })
  @ApiHeader({ name: CABECERA_SESION, required: false })
  async evento(
    @Body() dto: EventoDto,
    @Headers(CABECERA_SESION) token?: string,
  ) {
    const { sesion, condicion } = await this.contexto.resolver(token);
    const e = await this.prisma.evento.create({
      data: {
        id_sesion: sesion?.id_sesion ?? SIN_SESION,
        codigo_cliente: sesion?.codigo_cliente ?? dto.codigo_cliente,
        escenario: sesion?.escenario ?? dto.escenario ?? null,
        condicion,
        tipo_evento: dto.tipo_evento,
        texto_consulta: dto.texto_consulta ?? null,
        sku: dto.sku ?? null,
        posicion_recom: dto.posicion_recom ?? null,
        origen: dto.origen ?? null,
        timestamp: BigInt(dto.timestamp),
      },
    });
    return { status: 'ok', id_evento: Number(e.id) };
  }

  /**
   * Valida stock, recalcula el total con los precios del catálogo (ignora los del cliente), descuenta el stock y
   * registra el pedido y el evento CONFIRMACION_CARRITO con la hora del servidor, todo en una transacción.
   */
  @Post('carrito/confirmar')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: limite('THROTTLE_CONFIRMAR', 20), ttl: 60_000 },
  })
  @ApiHeader({ name: CABECERA_SESION, required: false })
  async confirmar(
    @Body() dto: ConfirmarCarritoDto,
    @Headers(CABECERA_SESION) token?: string,
  ) {
    const { sesion, condicion } = await this.contexto.resolver(token);
    const cantidades = new Map<string, { cantidad: number; origen: string }>();
    for (const i of dto.items) {
      const previo = cantidades.get(i.sku);
      cantidades.set(i.sku, {
        cantidad: (previo?.cantidad ?? 0) + i.cantidad,
        origen: previo?.origen ?? i.origen,
      });
    }
    if (cantidades.size === 0)
      throw new BadRequestException({ detail: 'El carrito está vacío' });

    const id_sesion = sesion?.id_sesion ?? SIN_SESION;
    const codigo_cliente = sesion?.codigo_cliente ?? dto.codigo_cliente;
    const escenario = sesion?.escenario ?? dto.escenario ?? null;

    return this.prisma.$transaction(async (tx) => {
      const productos = await tx.producto.findMany({
        where: { sku: { in: [...cantidades.keys()] }, activo: true },
      });
      const porSku = new Map(productos.map((p) => [p.sku, p]));
      const lineas = [...cantidades.entries()].map(
        ([sku, { cantidad, origen }]) => {
          const p = porSku.get(sku);
          if (!p)
            throw new NotFoundException({
              detail: `Producto no encontrado: ${sku}`,
            });
          return { p, cantidad, origen };
        },
      );
      for (const { p, cantidad } of lineas) {
        // Descuento condicional: nunca deja stock negativo, aun con confirmaciones simultáneas.
        const r = await tx.producto.updateMany({
          where: { sku: p.sku, stock: { gte: cantidad } },
          data: { stock: { decrement: cantidad } },
        });
        if (r.count === 0) {
          throw new ConflictException({
            detail: `Stock insuficiente para ${p.nombre} (disponible: ${p.stock})`,
          });
        }
      }
      const total = redondear(
        lineas.reduce((s, l) => s + Number(l.p.precio) * l.cantidad, 0),
      );
      const pedido = await tx.pedido.create({
        data: {
          id_sesion,
          codigo_cliente,
          escenario,
          condicion,
          entrega: dto.entrega ?? null,
          pago: dto.pago ?? null,
          total,
          items: {
            create: lineas.map((l) => ({
              sku: l.p.sku,
              cantidad: l.cantidad,
              precio: l.p.precio,
              origen: l.origen,
            })),
          },
        },
      });
      const ahora = Date.now();
      await tx.evento.create({
        data: {
          id_sesion,
          codigo_cliente,
          escenario,
          condicion,
          tipo_evento: 'CONFIRMACION_CARRITO',
          timestamp: BigInt(ahora),
        },
      });
      if (sesion)
        await tx.sesionEvaluacion.update({
          where: { id_sesion },
          data: { completa: true },
        });
      return {
        id_pedido: pedido.id,
        total,
        estado: pedido.estado,
        fecha: pedido.fecha,
        timestamp_confirmacion: ahora,
        entrega: pedido.entrega,
        pago: pedido.pago,
        items: lineas.map((l) => ({
          sku: l.p.sku,
          nombre: l.p.nombre,
          cantidad: l.cantidad,
          precio: Number(l.p.precio),
          subtotal: redondear(Number(l.p.precio) * l.cantidad),
          origen: l.origen,
        })),
      };
    });
  }
}
