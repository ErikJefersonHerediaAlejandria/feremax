// Importa un historial de ventas desde dos CSV (boletas e ítems). Idempotente: reemplaza las boletas con el mismo id.
// Uso: tsx prisma/scripts/importar-boletas.ts <boletas.csv> <boleta_items.csv> [--fuente=sintetico|empresa]
import { crearPrisma, leerCsv, trozos } from './lib.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

export async function importarBoletas(
  prisma: PrismaClient,
  rutaBoletas: string,
  rutaItems: string,
) {
  const boletas = leerCsv(rutaBoletas);
  const items = leerCsv(rutaItems);
  const skus = new Set(
    (await prisma.producto.findMany({ select: { sku: true } })).map(
      (p) => p.sku,
    ),
  );
  const desconocidos = new Set(
    items.filter((i) => !skus.has(i.sku)).map((i) => i.sku),
  );
  if (desconocidos.size)
    throw new Error(
      `SKU no existen en productos: ${[...desconocidos].join(', ')}`,
    );

  const ids = boletas.map((b) => b.id_boleta);
  for (const lote of trozos(ids, 5000))
    await prisma.boleta.deleteMany({ where: { id_boleta: { in: lote } } });
  for (const lote of trozos(boletas, 5000))
    await prisma.boleta.createMany({
      data: lote.map((b) => ({
        id_boleta: b.id_boleta,
        fecha: new Date(b.fecha),
        cliente_codigo: b.cliente_codigo,
      })),
    });
  for (const lote of trozos(items, 5000))
    await prisma.boletaItem.createMany({
      data: lote.map((i) => ({
        id_boleta: i.id_boleta,
        sku: i.sku,
        cantidad: Number(i.cantidad),
        precio: i.precio,
      })),
    });
  return { boletas: boletas.length, items: items.length };
}

if (
  process.argv[1]
    ?.replace(/\\/g, '/')
    .endsWith('prisma/scripts/importar-boletas.ts')
) {
  const [rutaB, rutaI] = process.argv
    .slice(2)
    .filter((a) => !a.startsWith('--'));
  const fuente = process.argv
    .find((a) => a.startsWith('--fuente='))
    ?.split('=')[1];
  if (!rutaB || !rutaI) {
    console.error(
      'Uso: importar-boletas.ts <boletas.csv> <boleta_items.csv> [--fuente=sintetico|empresa]',
    );
    process.exit(1);
  }
  const prisma = crearPrisma();
  const r = await importarBoletas(prisma, rutaB, rutaI);
  if (fuente)
    await prisma.configuracion.update({
      where: { id: 1 },
      data: { fuente_datos: fuente },
    });
  console.log(`Boletas importadas: ${r.boletas} (${r.items} ítems)`);
  await prisma.$disconnect();
}
