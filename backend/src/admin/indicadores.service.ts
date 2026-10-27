import { Injectable } from '@nestjs/common';
import type { Evento, SesionEvaluacion } from '../generated/prisma/client.js';
import { PrismaService } from '../comun/prisma.service.js';
import { mcnemarExacto, resumen } from './estadistica.js';

const K = 5;
const CONDICIONES = ['CONV', 'ML'] as const;

export interface MetricasSesion {
  id_sesion: string;
  codigo_cliente: string;
  escenario: string;
  condicion: string;
  orden: string;
  inicio: Date;
  fin: Date | null;
  valida: boolean;
  completa: boolean;
  tiempo_s: number | null;
  listas_mostradas: number;
  listas_sin_oportunidad: number;
  recs_mostradas: number;
  recs_aceptadas: number;
  precision_5: number | null;
  acierto: boolean;
}

/**
 * Métricas de una sesión a partir de sus eventos y de su pedido:
 * - Lista mostrada: eventos RECOM_MOSTRADA con el mismo timestamp (la tienda los envía juntos al pintar la lista).
 * - Recomendación aceptada: SKU mostrado en el top 5 que terminó en el pedido con origen RECOMENDACION.
 * - Precision@5 de la sesión: media, entre las listas mostradas, de |top5 ∩ aceptadas| / 5.
 * - Tiempo de selección: desde el primer INICIO_BUSQUEDA (o el primer evento) hasta CONFIRMACION_CARRITO.
 */
export function metricasSesion(
  s: SesionEvaluacion,
  eventos: Evento[],
  skusAceptables: Set<string>,
): MetricasSesion {
  const ordenados = [...eventos].sort((a, b) =>
    Number(a.timestamp - b.timestamp),
  );
  const inicio =
    ordenados.find((e) => e.tipo_evento === 'INICIO_BUSQUEDA') ?? ordenados[0];
  const cierre = ordenados.find(
    (e) => e.tipo_evento === 'CONFIRMACION_CARRITO',
  );
  const listas = new Map<string, Set<string>>();
  for (const e of ordenados) {
    if (
      e.tipo_evento !== 'RECOM_MOSTRADA' ||
      !e.sku ||
      (e.posicion_recom ?? 1) > K
    )
      continue;
    const clave = e.timestamp.toString();
    listas.set(clave, (listas.get(clave) ?? new Set()).add(e.sku));
  }
  const mostrados = new Set([...listas.values()].flatMap((l) => [...l]));
  const aceptadas = new Set(
    [...skusAceptables].filter((sku) => mostrados.has(sku)),
  );
  const precisiones = [...listas.values()].map(
    (l) => [...l].filter((sku) => aceptadas.has(sku)).length / K,
  );
  return {
    id_sesion: s.id_sesion,
    codigo_cliente: s.codigo_cliente,
    escenario: s.escenario,
    condicion: s.condicion,
    orden: s.orden,
    inicio: s.inicio,
    fin: s.fin,
    valida: s.valida,
    completa: s.completa,
    tiempo_s:
      inicio && cierre
        ? Number(cierre.timestamp - inicio.timestamp) / 1000
        : null,
    listas_mostradas: listas.size,
    listas_sin_oportunidad: precisiones.filter((p) => p === 0).length,
    recs_mostradas: mostrados.size,
    recs_aceptadas: aceptadas.size,
    precision_5: precisiones.length
      ? precisiones.reduce((a, b) => a + b, 0) / precisiones.length
      : null,
    acierto: aceptadas.size > 0,
  };
}

@Injectable()
export class IndicadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async calcular() {
    const sesiones = await this.prisma.sesionEvaluacion.findMany({
      orderBy: { inicio: 'asc' },
    });
    const ids = sesiones.map((s) => s.id_sesion);
    const [eventos, items] = await Promise.all([
      this.prisma.evento.findMany({ where: { id_sesion: { in: ids } } }),
      this.prisma.pedidoItem.findMany({
        where: { origen: 'RECOMENDACION', pedido: { id_sesion: { in: ids } } },
        select: { sku: true, pedido: { select: { id_sesion: true } } },
      }),
    ]);
    const eventosPor = new Map<string, Evento[]>();
    for (const e of eventos)
      eventosPor.set(e.id_sesion, [...(eventosPor.get(e.id_sesion) ?? []), e]);
    const aceptablesPor = new Map<string, Set<string>>();
    for (const i of items)
      aceptablesPor.set(
        i.pedido.id_sesion,
        (aceptablesPor.get(i.pedido.id_sesion) ?? new Set()).add(i.sku),
      );

    const metricas = sesiones.map((s) =>
      metricasSesion(
        s,
        eventosPor.get(s.id_sesion) ?? [],
        aceptablesPor.get(s.id_sesion) ?? new Set(),
      ),
    );
    const validas = metricas.filter((m) => m.valida && m.completa);

    const agregados = Object.fromEntries(
      CONDICIONES.map((c) => {
        const v = validas.filter((m) => m.condicion === c);
        return [
          c,
          {
            tiempo_seleccion_s: resumen(
              v.flatMap((m) => (m.tiempo_s === null ? [] : [m.tiempo_s])),
            ),
            precision_5: resumen(
              v.flatMap((m) => (m.precision_5 === null ? [] : [m.precision_5])),
            ),
            recs_aceptadas: resumen(v.map((m) => m.recs_aceptadas)),
            sesiones_validas_completas: v.length,
            sesiones_registradas: metricas.filter((m) => m.condicion === c)
              .length,
          },
        ];
      }),
    );

    // McNemar pareado por participante (diseño intra-sujeto): ¿aceptó al menos una recomendación en cada condición?
    const porCliente = new Map<
      string,
      Partial<Record<(typeof CONDICIONES)[number], boolean>>
    >();
    for (const m of validas) {
      const p = porCliente.get(m.codigo_cliente) ?? {};
      p[m.condicion as (typeof CONDICIONES)[number]] = m.acierto; // la última sesión válida de cada condición
      porCliente.set(m.codigo_cliente, p);
    }
    const pares = [...porCliente.values()].flatMap((p) =>
      p.CONV !== undefined && p.ML !== undefined
        ? [[p.CONV, p.ML] as [boolean, boolean]]
        : [],
    );

    return {
      agregados,
      por_sesion: Object.fromEntries(
        CONDICIONES.map((c) => [c, metricas.filter((m) => m.condicion === c)]),
      ),
      mcnemar_exacto: { CONV_vs_ML: mcnemarExacto(pares) },
      definiciones: {
        precision_5:
          'Media por lista mostrada de |top-5 ∩ productos recomendados que terminaron en el pedido| / 5',
        tiempo_seleccion_s:
          'Desde el primer INICIO_BUSQUEDA hasta CONFIRMACION_CARRITO',
        mcnemar:
          'Pares por participante (sesiones válidas y completas en ambas condiciones); acierto = ≥1 recomendación aceptada',
      },
    };
  }

  async dashboard() {
    const [pedidos, boletas, pedidosClientes, sesiones, bajoStock] =
      await Promise.all([
        this.prisma.pedido.findMany({ orderBy: { fecha: 'desc' }, take: 500 }),
        this.prisma.boleta.groupBy({
          by: ['cliente_codigo'],
          _min: { fecha: true },
          _count: { _all: true },
        }),
        this.prisma.pedido.groupBy({
          by: ['codigo_cliente'],
          _min: { fecha: true },
        }),
        this.prisma.sesionEvaluacion.findMany({
          select: { codigo_cliente: true },
          distinct: ['codigo_cliente'],
        }),
        this.prisma.producto.findMany({
          where: { activo: true, stock: { lte: 5 } },
          orderBy: { stock: 'asc' },
        }),
      ]);
    const participantes = new Set(sesiones.map((s) => s.codigo_cliente));
    const clientes = new Map<
      string,
      {
        codigo: string;
        tipo: string;
        primera_compra: Date | null;
        participa_evaluacion: boolean;
        n_boletas: number;
      }
    >();
    for (const b of boletas) {
      clientes.set(b.cliente_codigo, {
        codigo: b.cliente_codigo,
        tipo: 'Histórico',
        primera_compra: b._min.fecha,
        participa_evaluacion: false,
        n_boletas: b._count._all,
      });
    }
    for (const p of pedidosClientes) {
      const c = clientes.get(p.codigo_cliente);
      if (!c)
        clientes.set(p.codigo_cliente, {
          codigo: p.codigo_cliente,
          tipo: 'Tienda web',
          primera_compra: p._min.fecha,
          participa_evaluacion: false,
          n_boletas: 0,
        });
      else if (
        p._min.fecha &&
        (!c.primera_compra || p._min.fecha < c.primera_compra)
      )
        c.primera_compra = p._min.fecha;
    }
    for (const codigo of participantes) {
      const c = clientes.get(codigo) ?? {
        codigo,
        tipo: 'Participante',
        primera_compra: null,
        participa_evaluacion: false,
        n_boletas: 0,
      };
      c.participa_evaluacion = true;
      clientes.set(codigo, c);
    }
    return {
      pedidos: pedidos.map((p) => ({
        id: p.id,
        fecha: p.fecha,
        codigo_cliente: p.codigo_cliente,
        id_sesion: p.id_sesion,
        condicion: p.condicion,
        entrega: p.entrega,
        pago: p.pago,
        estado: p.estado,
        total: Number(p.total),
      })),
      clientes: [...clientes.values()].sort((a, b) =>
        a.codigo.localeCompare(b.codigo),
      ),
      productos_bajo_stock: bajoStock.map((p) => ({
        sku: p.sku,
        nombre: p.nombre,
        stock: p.stock,
      })),
    };
  }
}
