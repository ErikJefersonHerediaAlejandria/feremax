// Lighthouse (perfil móvil por defecto) sobre el build de producción. Exige ≥ 90 en rendimiento y accesibilidad.
// Corre cada página LH_RUNS veces (3 por defecto) y evalúa la corrida MEDIANA por rendimiento, como recomienda
// Google: la simulación con CPU 4× más lenta varía entre corridas según la carga del equipo.
// Requiere el frontend con `next start` y el API corriendo. Uso: npm run lighthouse  [BASE_URL=… LH_PRESET=desktop]
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const RUTAS = (process.env.LH_RUTAS ?? "/,/detalle/PIN-001").split(",");
const MINIMO = Number(process.env.LH_MINIMO ?? 0.9);
const salida = resolve(import.meta.dirname, "..", "lighthouse");
mkdirSync(salida, { recursive: true });
const CORRIDAS = Number(process.env.LH_RUNS ?? 3);
const cli = resolve(import.meta.dirname, "..", "node_modules/lighthouse/cli/index.js");

let fallos = 0;
for (const ruta of RUTAS) {
  const nombre = ruta === "/" ? "inicio" : ruta.replace(/^\//, "").replace(/\W+/g, "_");
  const reportes = [];
  for (let n = 1; n <= CORRIDAS; n++) {
  const base = join(salida, CORRIDAS > 1 ? `${nombre}-${n}` : nombre);
  const args = [
    cli,
    BASE + ruta,
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=json",
    "--output=html",
    `--output-path=${base}`,
    `--chrome-flags=--headless=new --no-sandbox`,
    "--quiet",
  ];
  if (process.env.LH_PRESET) args.push(`--preset=${process.env.LH_PRESET}`);
  execFileSync(process.execPath, args, { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, stdio: "inherit" });
  reportes.push(JSON.parse(readFileSync(`${base}.report.json`, "utf8")));
  }
  reportes.sort((a, b) => a.categories.performance.score - b.categories.performance.score);
  const r = reportes[Math.floor(reportes.length / 2)];
  const todas = reportes.map((x) => Math.round(x.categories.performance.score * 100)).join("/");
  const p = (c) => Math.round(r.categories[c].score * 100);
  const ok = r.categories.performance.score >= MINIMO && r.categories.accessibility.score >= MINIMO;
  if (!ok) fallos++;
  console.log(
    `${ok ? "✓" : "✗"} ${ruta.padEnd(20)} rendimiento ${p("performance")} (mediana de ${todas}) · accesibilidad ${p("accessibility")} · buenas prácticas ${p("best-practices")} · SEO ${p("seo")}` +
      `   (LCP ${r.audits["largest-contentful-paint"].displayValue}, CLS ${r.audits["cumulative-layout-shift"].displayValue}, TBT ${r.audits["total-blocking-time"].displayValue})`,
  );
  if (!ok) {
    for (const [id, a] of Object.entries(r.audits)) {
      if (a.score !== null && a.score < 0.9 && ["opportunity", "metricSavings"].some((k) => k in a || a.details?.type === k) && a.scoreDisplayMode !== "informative") {
        console.log(`    - ${id}: ${a.title} ${a.displayValue ?? ""}`);
      }
    }
    for (const ref of r.categories.accessibility.auditRefs) {
      const a = r.audits[ref.id];
      if (ref.weight > 0 && a.score !== null && a.score < 1) console.log(`    - [a11y] ${a.id}: ${a.title}`);
    }
  }
}
console.log(`\nInformes HTML en ${salida}`);
process.exit(fallos ? 1 : 0);
