import "dotenv/config";
import { defineConfig } from "prisma/config";

// El CLI (migraciones) usa la conexión directa; la app usa DATABASE_URL (pooler en Supabase).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` no necesita conexión: sin variables (p. ej. en npm ci) la URL queda vacía.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
