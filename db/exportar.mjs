// Limpia un pg_dump (--inserts) para que se pueda ejecutar en Supabase (SQL Editor o psql).
// Uso: node db/exportar.mjs <raw.sql> <salida.sql>
import { readFileSync, writeFileSync } from "node:fs";

const [entrada, salida] = process.argv.slice(2);
const omitir = [
  /^SET transaction_timeout/, // solo existe desde PostgreSQL 17
  /^CREATE SCHEMA public;/, // Supabase ya tiene el esquema public
  /^COMMENT ON SCHEMA public/,
  /^\\(un)?restrict /, // meta-comandos de psql 18, no válidos en el SQL Editor
  /^SELECT pg_catalog\.set_config\('search_path'/,
];

const out = [];
let saltando = false;
for (const linea of readFileSync(entrada, "utf8").split(/\r?\n/)) {
  if (saltando) {
    if (linea.trimEnd().endsWith(";")) saltando = false;
    continue;
  }
  // No se exportan administradores: el de desarrollo tiene una contraseña de prueba.
  if (linea.startsWith("INSERT INTO public.admins ")) {
    saltando = !linea.trimEnd().endsWith(";");
    continue;
  }
  if (omitir.some((r) => r.test(linea))) continue;
  out.push(linea);
}

const cabecera = `-- =====================================================================
-- FerreMax v2 · Base de datos completa (esquema + datos)
-- Generado desde ferremax_dev (Prisma 7.10.1, migración 20261026235559_inicial)
--
-- Contenido: 52 productos, configuración, 5.000 boletas SINTÉTICAS (13.556 ítems) y la
--            tabla _prisma_migrations, para que \`prisma migrate deploy\` la reconozca.
-- NO incluye administradores: el admin se crea con el seed (ver db/LEEME.md).
--
-- Uso: Supabase > SQL Editor > pegar > Run, o bien: psql "<DIRECT_URL>" -f ferremax_v2.sql
-- Corre en una sola transacción: si algo falla, no queda nada a medias.
-- Requiere una base sin estas tablas.
-- =====================================================================
BEGIN;
`;
writeFileSync(salida, cabecera + out.join("\n") + "\nCOMMIT;\n");
console.log(`OK → ${salida}`);
