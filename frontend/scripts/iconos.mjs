// Regenera src/lib/iconos.ts con los nombres de Material Symbols que aparecen en el código (literales de texto).
// Uso: npm run iconos   (scripts/material-symbols.txt = lista oficial de nombres de Google)
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const raiz = resolve(import.meta.dirname, "..");
const validos = new Set(readFileSync(join(raiz, "scripts/material-symbols.txt"), "utf8").split(/\r?\n/).filter(Boolean));
const usados = new Set();
const recorrer = (dir) => {
  for (const n of readdirSync(dir)) {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) recorrer(ruta);
    else if (/\.(tsx?|jsx?)$/.test(n) && !ruta.endsWith("iconos.ts")) {
      for (const m of readFileSync(ruta, "utf8").matchAll(/["'`]([a-z][a-z0-9_]{1,40})["'`]/g)) if (validos.has(m[1])) usados.add(m[1]);
    }
  }
};
recorrer(join(raiz, "src"));
const lista = [...usados].sort();
const destino = join(raiz, "src/lib/iconos.ts");
const actual = readFileSync(destino, "utf8");
const nuevo = actual.replace(/export const ICONOS = \[[\s\S]*?\];/, `export const ICONOS = [\n${lista.map((i) => `  "${i}",`).join("\n")}\n];`);
writeFileSync(destino, nuevo);
console.log(`${lista.length} íconos: ${lista.join(", ")}`);
