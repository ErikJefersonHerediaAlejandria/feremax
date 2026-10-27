// Regenera src/lib/iconos.ts con los nombres de Material Symbols que aparecen en el código (literales de texto)
// y descarga el subconjunto de la fuente a public/fonts/material-symbols.woff2 (se sirve desde el propio sitio).
// Uso: npm run iconos   (scripts/material-symbols.txt = lista oficial de nombres de Google)
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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

// Subconjunto woff2 (Google Fonts entrega solo los glifos pedidos en icon_names)
const css = await (
  await fetch(`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${lista.join(",")}&display=block`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36" },
  })
).text();
const url = css.match(/src: url\((https:[^)]+)\) format\('woff2'\)/)?.[1];
if (!url) throw new Error("No se encontró la URL woff2 en la respuesta de Google Fonts");
const fuente = Buffer.from(await (await fetch(url)).arrayBuffer());
mkdirSync(join(raiz, "public/fonts"), { recursive: true });
writeFileSync(join(raiz, "public/fonts/material-symbols.woff2"), fuente);
console.log(`Fuente de íconos: public/fonts/material-symbols.woff2 (${(fuente.length / 1024).toFixed(1)} KB)`);
