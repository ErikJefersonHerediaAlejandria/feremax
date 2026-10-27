// Levanta todo el entorno local: PostgreSQL (puerto 5433), recommender (8001), API (4000) y web (3000).
// Uso: npm run dev   (Ctrl+C para detener todo)
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..");
const pgBin = process.env.PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const uv = existsSync(join(homedir(), ".local/bin/uv.exe")) ? join(homedir(), ".local/bin/uv.exe") : "uv";
const colores = { db: 90, recommender: 35, api: 36, web: 32 };

function log(nombre, texto) {
  for (const linea of texto.toString().split(/\r?\n/)) if (linea.trim()) console.log(`\x1b[${colores[nombre]}m[${nombre}]\x1b[0m ${linea}`);
}

// 1. PostgreSQL del proyecto (.pgdata). Si ya está corriendo, no hace nada.
const listo = spawnSync(join(pgBin, "pg_isready"), ["-h", "localhost", "-p", "5433"]).status === 0;
if (!listo) {
  log("db", "Iniciando PostgreSQL en el puerto 5433…");
  const r = spawnSync(join(pgBin, "pg_ctl"), ["-D", join(raiz, ".pgdata"), "-o", "-p 5433", "-l", join(raiz, ".pgdata/server.log"), "-w", "start"]);
  log("db", r.stdout.toString() || r.stderr.toString());
} else log("db", "PostgreSQL ya está activo en el puerto 5433");

const procesos = [];
function iniciar(nombre, comando, args, cwd, env = {}) {
  const p = spawn(comando, args, { cwd: join(raiz, cwd), env: { ...process.env, ...env }, shell: process.platform === "win32" });
  p.stdout.on("data", (d) => log(nombre, d));
  p.stderr.on("data", (d) => log(nombre, d));
  p.on("exit", (c) => log(nombre, `terminó (código ${c})`));
  procesos.push(p);
}

iniciar("recommender", `"${uv}"`, ["run", "uvicorn", "ferremax_recommender.api:app", "--port", "8001"], "recommender");
iniciar("api", "npx", ["nest", "start", "--watch"], "backend", { COOKIE_SECURE: "false" });
iniciar("web", "npx", ["next", "dev", "--port", "3000"], "frontend");

console.log("\n  Tienda:  http://localhost:3000\n  Admin:   http://localhost:3000/admin  (usuario admin)\n  API:     http://localhost:4000/api/docs\n");

const detener = () => {
  for (const p of procesos) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"]);
    else p.kill("SIGTERM");
  }
  process.exit(0);
};
process.on("SIGINT", detener);
process.on("SIGTERM", detener);
