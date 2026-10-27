// Seed idempotente: catálogo, configuración, admin inicial y (si la tabla está vacía) el historial sintético.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as argon2 from "argon2";
import { crearPrisma } from "./scripts/lib.js";
import { importarBoletas } from "./scripts/importar-boletas.js";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "../../data");

type ProductoSeed = {
  sku: string; nombre: string; marca: string | null; categoria: string | null; subcategoria: string | null;
  unidad: string | null; uso: string | null; precio: number; stock: number;
};

const prisma = crearPrisma();

const productos: ProductoSeed[] = JSON.parse(readFileSync(join(DATA, "seed/productos.json"), "utf8"));
for (const p of productos) {
  const datos = { ...p, imagen_url: `/img/productos/${encodeURIComponent(p.sku)}.webp` };
  // El stock solo se fija al crear: volver a ejecutar el seed no pisa las ventas registradas.
  const { stock: _stock, ...actualizables } = datos;
  await prisma.producto.upsert({ where: { sku: p.sku }, create: datos, update: actualizables });
}

await prisma.configuracion.upsert({
  where: { id: 1 },
  create: { id: 1, modo_activo: "ML", k: 5, soporte_min: 0.01, confianza_min: 0.15, lift_min: 1.2, peso_contenido: 1.0, variante_ml: "COMPLETO", fuente_datos: "sintetico" },
  update: {},
});

const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD;
if (password) {
  const existe = await prisma.admin.findUnique({ where: { username } });
  if (!existe) await prisma.admin.create({ data: { username, password_hash: await argon2.hash(password, { type: argon2.argon2id }) } });
} else console.warn("ADMIN_PASSWORD no definido: no se crea el admin inicial.");

let boletas = "ya cargadas";
if ((await prisma.boleta.count()) === 0 && existsSync(join(DATA, "sintetico/boletas.csv"))) {
  const r = await importarBoletas(prisma, join(DATA, "sintetico/boletas.csv"), join(DATA, "sintetico/boleta_items.csv"));
  boletas = `${r.boletas} sintéticas (${r.items} ítems)`;
}

console.log(`Seed OK · productos: ${productos.length} · configuración: id=1 · admin: ${username} · boletas: ${boletas}`);
await prisma.$disconnect();
