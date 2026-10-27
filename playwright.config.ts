// Pruebas de punta a punta (Playwright) contra la pila completa en modo producción:
// recommender (8001) + API NestJS compilada (4000) + Next.js compilado (3000).
// Antes: `npm --prefix backend run build` y `npm --prefix frontend run build` (el build del frontend necesita el API).
// Si los servicios ya están corriendo (`npm run dev` o el CI, que los levanta antes), se reutilizan.
import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const uvLocal = join(homedir(), ".local", "bin", process.platform === "win32" ? "uv.exe" : "uv");
const uv = existsSync(uvLocal) ? `"${uvLocal}"` : "uv";
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // comparten la BD y una sola sesión experimental activa a la vez
  retries: CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-PE",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive/ },
    { name: "movil", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } }, testMatch: /responsive/ },
  ],
  webServer: [
    {
      command: `${uv} run uvicorn ferremax_recommender.api:app --port 8001`,
      cwd: "recommender",
      url: "http://localhost:8001/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "node dist/main.js",
      cwd: "backend",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npx next start --port 3000",
      cwd: "frontend",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
