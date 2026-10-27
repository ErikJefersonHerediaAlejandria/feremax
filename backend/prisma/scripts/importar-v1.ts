// Importa un respaldo de FerreMax v1 a la base v2. Idempotente (upsert por clave natural).
// Uso: tsx prisma/scripts/importar-v1.ts <carpeta> [--dry-run]
//
// La carpeta puede contener, en JSON (arreglo) o CSV, cualquiera de estos archivos:
//   productos, boletas, boleta_items, reglas, sesiones, eventos, pedidos, pedido_items, configuracion
// Los nombres de campos son los de v1 (p. ej. reglas.antecedentes como texto JSON, pedido.id_pedido).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearPrisma, leerCsv, trozos } from './lib.js';
import type { Modo } from '../../src/generated/prisma/client.js';

type Valor = string | number | boolean | null | Valor[];
type Fila = Record<string, Valor | undefined>;

export function leerTabla(carpeta: string, nombre: string): Fila[] | null {
  const json = join(carpeta, `${nombre}.json`);
  const csv = join(carpeta, `${nombre}.csv`);
  if (existsSync(json)) return JSON.parse(readFileSync(json, 'utf8')) as Fila[];
  if (existsSync(csv)) return leerCsv(csv);
  return null;
}

const txt = (v: Valor | undefined) =>
  v === undefined || v === null || v === '' ? null : String(v);
const num = (v: Valor | undefined) =>
  v === undefined || v === null || v === '' ? null : Number(v);
const bool = (v: Valor | undefined) =>
  v === true ||
  v === 1 ||
  ['true', '1', 't', 'si', 'sí'].includes(String(v).toLowerCase());
export const lista = (v: Valor | undefined): string[] => {
  if (Array.isArray(v)) return v.map(String);
  const s = String(v ?? '').trim();
  if (s.startsWith('[')) return (JSON.parse(s) as unknown[]).map(String);
  if (s.startsWith('{'))
    return s
      .slice(1, -1)
      .split(',')
      .map((x) => x.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  return s ? s.split(/[|;]/).map((x) => x.trim()) : [];
};
const modo = (v: Valor | undefined): Modo =>
  String(v).toUpperCase() === 'CONV' ? 'CONV' : 'ML';
// v1 guarda fechas en UTC; un texto sin zona horaria se interpreta como UTC (no como hora local del equipo).
export const fecha = (v: Valor | undefined) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return new Date(v);
  const s = String(v).trim().replace(' ', 'T');
  return new Date(
    /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) || !s.includes('T') ? s : `${s}Z`,
  );
};

export async function importarV1(carpeta: string, dryRun = false) {
  const prisma = crearPrisma();
  const resumen: Record<string, number> = {};
  const t = (nombre: string) => {
    const filas = leerTabla(carpeta, nombre);
    if (filas) resumen[nombre] = filas.length;
    return filas;
  };

  const productos = t('productos');
  const boletas = t('boletas');
  const boletaItems = t('boleta_items');
  const reglas = t('reglas');
  const sesiones = t('sesiones');
  const eventos = t('eventos');
  const pedidos = t('pedidos');
  const pedidoItems = t('pedido_items');
  const configuracion = t('configuracion');

  if (dryRun) {
    await prisma.$disconnect();
    return resumen;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const p of productos ?? [])
        await tx.producto.upsert({
          where: { sku: String(p.sku) },
          create: {
            sku: String(p.sku),
            nombre: String(p.nombre),
            marca: txt(p.marca),
            categoria: txt(p.categoria),
            subcategoria: txt(p.subcategoria),
            unidad: txt(p.unidad),
            uso: txt(p.uso),
            precio: String(p.precio),
            stock: Number(p.stock ?? 0),
            activo: p.activo === undefined ? true : bool(p.activo),
            imagen_url:
              txt(p.imagen_url) ??
              `/img/productos/${encodeURIComponent(String(p.sku))}.webp`,
          },
          update: {
            nombre: String(p.nombre),
            marca: txt(p.marca),
            categoria: txt(p.categoria),
            subcategoria: txt(p.subcategoria),
            unidad: txt(p.unidad),
            uso: txt(p.uso),
            precio: String(p.precio),
            stock: Number(p.stock ?? 0),
          },
        });

      if (boletas) {
        const ids = boletas.map((b) => String(b.id_boleta ?? b.id));
        for (const lote of trozos(ids, 5000))
          await tx.boleta.deleteMany({ where: { id_boleta: { in: lote } } });
        await tx.boleta.createMany({
          data: boletas.map((b) => ({
            id_boleta: String(b.id_boleta ?? b.id),
            fecha: fecha(b.fecha)!,
            cliente_codigo: String(b.cliente_codigo ?? b.codigo_cliente),
          })),
        });
        await tx.boletaItem.createMany({
          data: (boletaItems ?? []).map((i) => ({
            id_boleta: String(i.id_boleta),
            sku: String(i.sku),
            cantidad: Number(i.cantidad),
            precio: String(i.precio),
          })),
        });
      }

      if (reglas) {
        // Las reglas del respaldo reemplazan a las vigentes; reimportar la misma versión no duplica.
        const versiones = [
          ...new Set(reglas.map((r) => txt(r.version_modelo) ?? 'v1')),
        ];
        await tx.reglaAsociacion.deleteMany({
          where: { version_modelo: { in: versiones } },
        });
        await tx.reglaAsociacion.updateMany({
          where: { vigente: true },
          data: { vigente: false },
        });
        await tx.reglaAsociacion.createMany({
          data: reglas.map((r) => ({
            antecedente: lista(r.antecedente ?? r.antecedentes),
            consecuente: lista(r.consecuente ?? r.consecuentes),
            soporte: Number(r.soporte),
            confianza: Number(r.confianza),
            lift: Number(r.lift),
            vigente: r.vigente === undefined ? true : bool(r.vigente),
            version_modelo: txt(r.version_modelo) ?? 'v1',
          })),
        });
      }

      for (const s of sesiones ?? []) {
        const id = String(s.id_sesion);
        const datos = {
          codigo_cliente: String(s.codigo_cliente),
          escenario: String(s.escenario ?? ''),
          condicion: modo(s.condicion),
          orden: String(s.orden ?? ''),
          inicio: fecha(s.inicio) ?? new Date(),
          fin: fecha(s.fin),
          valida: s.valida === undefined ? true : bool(s.valida),
          completa:
            s.completa === undefined ? Boolean(s.fin) : bool(s.completa),
        };
        await tx.sesionEvaluacion.upsert({
          where: { id_sesion: id },
          create: {
            id_sesion: id,
            token_dispositivo: txt(s.token_dispositivo) ?? `v1-${id}`,
            ...datos,
          },
          update: datos,
        });
      }

      if (eventos) {
        // Clave natural de un evento: sesión + tipo + timestamp + sku.
        const sesionesEv = [
          ...new Set(eventos.map((e) => String(e.id_sesion))),
        ];
        await tx.evento.deleteMany({
          where: { id_sesion: { in: sesionesEv } },
        });
        await tx.evento.createMany({
          data: eventos.map((e) => ({
            id_sesion: String(e.id_sesion),
            codigo_cliente: String(e.codigo_cliente),
            escenario: txt(e.escenario),
            condicion: modo(e.condicion),
            tipo_evento: String(e.tipo_evento),
            texto_consulta: txt(e.texto_consulta),
            sku: txt(e.sku),
            posicion_recom: num(e.posicion_recom),
            origen: txt(e.origen),
            timestamp: BigInt(String(e.timestamp)),
          })),
        });
      }

      for (const p of pedidos ?? []) {
        const id = Number(p.id_pedido ?? p.id);
        const items = (pedidoItems ?? []).filter(
          (i) => Number(i.id_pedido ?? i.pedido_id) === id,
        );
        const datos = {
          fecha: fecha(p.fecha) ?? new Date(),
          id_sesion: String(p.id_sesion ?? 'SIN-SESION'),
          codigo_cliente: String(p.codigo_cliente),
          escenario: txt(p.escenario),
          condicion: modo(p.condicion),
          entrega: txt(p.entrega),
          pago: txt(p.pago),
          total: String(p.total),
          estado: txt(p.estado) ?? 'Registrado',
        };
        await tx.pedidoItem.deleteMany({ where: { pedido_id: id } });
        await tx.pedido.upsert({
          where: { id },
          create: { id, ...datos },
          update: datos,
        });
        await tx.pedidoItem.createMany({
          data: items.map((i) => ({
            pedido_id: id,
            sku: String(i.sku),
            cantidad: Number(i.cantidad),
            precio: String(i.precio),
            origen: String(i.origen ?? 'BUSQUEDA'),
          })),
        });
      }
      if (pedidos?.length)
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('pedidos','id'), (SELECT MAX(id) FROM pedidos))`,
        );

      const c = configuracion?.[0];
      if (c)
        await tx.configuracion.update({
          where: { id: 1 },
          data: {
            modo_activo: modo(c.modo_activo),
            k: Number(c.k),
            soporte_min: Number(c.soporte_min),
            confianza_min: Number(c.confianza_min),
            lift_min: Number(c.lift_min),
            peso_contenido: Number(c.peso_contenido),
            variante_ml: String(c.variante_ml ?? 'COMPLETO'),
            fuente_datos: String(c.fuente_datos ?? 'empresa'),
          },
        });
    },
    { timeout: 600_000 },
  );

  await prisma.$disconnect();
  return resumen;
}

if (
  process.argv[1]?.replace(/\\/g, '/').endsWith('prisma/scripts/importar-v1.ts')
) {
  const carpeta = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!carpeta) {
    console.error('Uso: importar-v1.ts <carpeta> [--dry-run]');
    process.exit(1);
  }
  const dry = process.argv.includes('--dry-run');
  const r = await importarV1(carpeta, dry);
  console.log(`${dry ? '[dry-run] Se importarían' : 'Importado'}:`, r);
}
