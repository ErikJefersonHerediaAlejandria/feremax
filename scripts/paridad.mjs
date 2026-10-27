// Paridad v1 ↔ v2: hace las mismas peticiones GET a ambos y compara la FORMA de las respuestas (estado HTTP,
// campos y tipos, recursivamente). Los valores (puntajes, stock, orden) pueden diferir.
// Solo usa GET contra v1 (producción). Uso: npm run paridad  [V1_URL=… V2_URL=…]
const V1 = (process.env.V1_URL ?? "https://sosdigital.lat").replace(/\/$/, "");
const V2 = (process.env.V2_URL ?? "http://localhost:4000").replace(/\/$/, "");

// [ruta, nota]. Las diferencias intencionales están documentadas en DECISIONES.md.
const CASOS = [
  ["/api/productos"],
  ["/api/productos?categoria=Gasfiter%C3%ADa"],
  ["/api/productos/VAL-002"],
  ["/api/productos/NO-EXISTE"],
  ["/api/categorias"],
  ["/api/recomendar?sku=VAL-002&k=5"],
  ["/api/recomendar?sku=PIN-001&k=3"],
  ["/api/recomendar/cliente/CLI-0001?skus=VAL-002&k=5"],
  ["/api/sesiones/activa"],
  ["/api/admin/verificar"],
  ["/api/admin/reglas"],
  ["/api/admin/sesiones"],
  ["/api/admin/eventos"],
  ["/api/admin/dashboard"],
  ["/api/admin/indicadores"],
  ["/api/admin/config", "D-38: sin login, v2 solo expone {k, fuente_datos} para no revelar la condición"],
];

/** Forma de un valor JSON: tipos de hojas, claves de objetos y forma del primer elemento de los arreglos. */
function forma(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return v.length ? [forma(v[0])] : ["vacío"];
  if (typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, forma(v[k])]));
  return typeof v;
}

/** Diferencias entre dos formas. `null` es compatible con cualquier tipo (campos opcionales). */
function comparar(a, b, ruta = "$") {
  if (a === "null" || b === "null") return [];
  if (Array.isArray(a) && Array.isArray(b)) return a[0] === "vacío" || b[0] === "vacío" ? [] : comparar(a[0], b[0], `${ruta}[]`);
  if (typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const difs = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in b)) difs.push(`${ruta}.${k}: solo en v1`);
      else if (!(k in a)) difs.push(`${ruta}.${k}: solo en v2`);
      else difs.push(...comparar(a[k], b[k], `${ruta}.${k}`));
    }
    return difs;
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [`${ruta}: v1 ${JSON.stringify(a)} ≠ v2 ${JSON.stringify(b)}`];
}

async function pedir(base, ruta) {
  const r = await fetch(base + ruta, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  const texto = await r.text();
  let cuerpo;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = texto.slice(0, 80);
  }
  return { estado: r.status, cuerpo };
}

let fallos = 0;
console.log(`Paridad de formas  v1 = ${V1}   v2 = ${V2}\n`);
for (const [ruta, nota] of CASOS) {
  const [a, b] = await Promise.all([pedir(V1, ruta), pedir(V2, ruta)]);
  const difs = a.estado !== b.estado ? [`estado HTTP: v1 ${a.estado} ≠ v2 ${b.estado}`] : comparar(forma(a.cuerpo), forma(b.cuerpo));
  const esperado = Boolean(nota);
  const estado = difs.length === 0 ? "✓ igual" : esperado ? "≈ diferencia documentada" : "✗ DIFERENTE";
  if (difs.length && !esperado) fallos++;
  console.log(`${estado.padEnd(26)} ${String(a.estado).padEnd(4)} GET ${ruta}`);
  for (const d of difs) console.log(`      ${d}`);
  if (nota && difs.length) console.log(`      → ${nota}`);
}
console.log(`\n${fallos === 0 ? "OK: las formas de v2 coinciden con v1" : `${fallos} ruta(s) con diferencias no documentadas`}`);
process.exit(fallos ? 1 : 0);
