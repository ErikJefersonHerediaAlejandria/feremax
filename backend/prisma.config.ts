import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// El CLI (migraciones) usa la conexión directa; la app usa DATABASE_URL (pooler en Supabase).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
