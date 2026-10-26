// Genera un historial de ventas SINTÉTICO (boletas) para entrenar el recomendador.
// Determinista: misma semilla → mismos archivos.
// Uso: node data/scripts/generar_sintetico.mjs [n_boletas=5000] [semilla=2026]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const N_BOLETAS = Number(process.argv[2] ?? 5000);
const SEMILLA = Number(process.argv[3] ?? 2026);
const N_CLIENTES = 900;
const INICIO = Date.UTC(2024, 0, 2);
const FIN = Date.UTC(2026, 8, 30);

// mulberry32
let s = SEMILLA >>> 0;
const rnd = () => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
const elegirPeso = (pares) => {
  const total = pares.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pares) if ((r -= w) < 0) return v;
  return pares[pares.length - 1][0];
};

const productos = JSON.parse(readFileSync(join(raiz, "seed/productos.json"), "utf8"));
const porSku = new Map(productos.map((p) => [p.sku, p]));

// Proyectos de compra: núcleo (uno de) + complementos con probabilidad.
const PROYECTOS = {
  pintar_interior: { nucleo: ["PIN-001", "PIN-002"], comp: { "PIN-007": 0.6, "PIN-008": 0.35, "FER-003": 0.45, "HER-005": 0.08 } },
  esmaltar: { nucleo: ["PIN-003", "PIN-004"], comp: { "FER-003": 0.4, "PIN-005": 0.15, "PIN-004": 0.1 } },
  aerosol: { nucleo: ["PIN-005", "PIN-006"], comp: { "FER-003": 0.35, "PIN-006": 0.2, "PIN-005": 0.2 } },
  agua_fria: { nucleo: ["TUB-001", "TUB-002"], comp: { "ACC-001": 0.7, "ACC-002": 0.45, "ACC-004": 0.6, "VAL-002": 0.55, "VAL-001": 0.3 } },
  desague: { nucleo: ["TUB-003", "TUB-004"], comp: { "ACC-003": 0.7, "ACC-004": 0.6, "TUB-003": 0.15 } },
  bano: { nucleo: ["LAV-001", "IFO-001"], comp: { "VAL-002": 0.5, "FER-001": 0.55, "VAL-001": 0.3, "ACC-004": 0.2, "TUB-003": 0.15 } },
  fuga: { nucleo: ["VAL-002"], comp: { "FER-001": 0.3, "ACC-001": 0.3, "VAL-001": 0.15 } },
  cableado: { nucleo: ["ELE-001", "ELE-002", "ELE-003"], comp: { "ELE-007": 0.7, "ELE-004": 0.4, "ELE-005": 0.45, "ELE-006": 0.25, "HER-004": 0.2 } },
  iluminacion: { nucleo: ["ELE-008"], comp: { "ELE-004": 0.4, "ELE-007": 0.3, "ELE-008": 0.1 } },
  tablero: { nucleo: ["ELE-006"], comp: { "ELE-002": 0.35, "ELE-001": 0.25, "ELE-007": 0.5 } },
  vaciado: { nucleo: ["CON-001", "CON-002"], comp: { "FIE-001": 0.5, "FIE-002": 0.4, "FIE-003": 0.35, "ALA-001": 0.3, "CON-003": 0.2 } },
  impermeabilizar: { nucleo: ["CON-004"], comp: { "CON-003": 0.3, "CON-001": 0.25, "FER-003": 0.1 } },
  fierreria: { nucleo: ["FIE-001", "FIE-002"], comp: { "ALA-001": 0.5, "FIE-003": 0.4, "HER-008": 0.1 } },
  carpinteria: { nucleo: ["CLO-001", "CLO-002", "FER-004"], comp: { "HER-001": 0.45, "CLO-002": 0.25, "FER-002": 0.2, "HER-008": 0.2, "HER-005": 0.15 } },
  fijacion: { nucleo: ["FER-005"], comp: { "FER-006": 0.55, "FER-004": 0.4, "HER-006": 0.15 } },
  taladro: { nucleo: ["HER-006", "HER-007"], comp: { "FER-006": 0.6, "FER-005": 0.4 } },
  destornillar: { nucleo: ["HER-002", "HER-003"], comp: { "HER-003": 0.5, "HER-002": 0.5, "HER-004": 0.2 } },
  herramientas: { nucleo: ["HER-001", "HER-004", "HER-005", "HER-008"], comp: { "HER-005": 0.2, "HER-002": 0.15 } },
  pegado: { nucleo: ["FER-002", "FER-001"], comp: { "FER-003": 0.3 } },
};

// Perfil de cliente → peso de cada proyecto.
const PERFILES = {
  pintor: { pintar_interior: 8, esmaltar: 3, aerosol: 2, pegado: 1, herramientas: 1 },
  gasfitero: { agua_fria: 7, desague: 4, bano: 3, fuga: 4, pegado: 1 },
  electricista: { cableado: 6, iluminacion: 4, tablero: 3, destornillar: 2, herramientas: 1 },
  maestro_obra: { vaciado: 7, fierreria: 4, impermeabilizar: 2, carpinteria: 2, taladro: 1 },
  carpintero: { carpinteria: 6, fijacion: 3, taladro: 2, pegado: 2, destornillar: 1 },
  hogar: Object.fromEntries(Object.keys(PROYECTOS).map((k) => [k, 1])),
};
const PESO_PERFIL = [["hogar", 40], ["pintor", 12], ["gasfitero", 14], ["electricista", 12], ["maestro_obra", 14], ["carpintero", 8]];

const clientes = Array.from({ length: N_CLIENTES }, (_, i) => ({
  codigo: `CLI-${String(i + 1).padStart(4, "0")}`,
  perfil: elegirPeso(PESO_PERFIL),
  peso: 1 / Math.pow(i + 1, 0.6), // pocos clientes compran mucho
}));
const pesoClientes = clientes.map((c) => [c, c.peso]);

const cantidadPara = (p) => {
  if (p.precio >= 150) return 1;
  if (/kg/.test(p.nombre) && p.categoria.startsWith("Construcción") && p.sku.startsWith("CON")) return 1 + Math.floor(rnd() * 10);
  if (p.sku.startsWith("FIE")) return 2 + Math.floor(rnd() * 12);
  if (p.precio < 5) return 1 + Math.floor(rnd() * 8);
  return rnd() < 0.75 ? 1 : 2 + Math.floor(rnd() * 3);
};

// Fechas: más volumen con el tiempo, sábados más cargados, horario 7:00–19:00 (Lima, UTC-5).
const fechas = [];
while (fechas.length < N_BOLETAS) {
  const t = INICIO + rnd() * (FIN - INICIO);
  const avance = (t - INICIO) / (FIN - INICIO);
  const d = new Date(t);
  const dia = d.getUTCDay();
  if (dia === 0) continue; // domingo cerrado
  const pesoDia = dia === 6 ? 1.4 : 1;
  if (rnd() > (0.55 + 0.45 * avance) * pesoDia / 1.4) continue;
  const hora = 7 + Math.floor(rnd() * 12);
  fechas.push(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hora + 5, Math.floor(rnd() * 60), Math.floor(rnd() * 60)));
}
fechas.sort((a, b) => a - b);

const boletas = [];
const items = [];
fechas.forEach((t, i) => {
  const id = `B${String(i + 1).padStart(6, "0")}`;
  const cliente = elegirPeso(pesoClientes);
  const pesos = Object.entries(PERFILES[cliente.perfil]);
  const lineas = new Map();
  const nProyectos = rnd() < 0.18 ? 2 : 1;
  for (let k = 0; k < nProyectos; k++) {
    const proy = PROYECTOS[elegirPeso(pesos)];
    lineas.set(elegir(proy.nucleo), true);
    for (const [sku, prob] of Object.entries(proy.comp)) if (rnd() < prob) lineas.set(sku, true);
  }
  if (rnd() < 0.2) lineas.set(elegir(productos).sku, true); // compra impulsiva / ruido
  const avance = (t - INICIO) / (FIN - INICIO);
  boletas.push([id, new Date(t).toISOString(), cliente.codigo]);
  for (const sku of lineas.keys()) {
    const p = porSku.get(sku);
    const precio = Math.round(p.precio * (0.9 + 0.1 * avance) * 10) / 10; // inflación leve hasta el precio actual
    items.push([id, sku, cantidadPara(p), precio.toFixed(2)]);
  }
});

const csv = (filas) => filas.map((f) => f.join(",")).join("\n") + "\n";
const salida = join(raiz, "sintetico");
mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, "boletas.csv"), csv([["id_boleta", "fecha", "cliente_codigo"], ...boletas]));
writeFileSync(join(salida, "boleta_items.csv"), csv([["id_boleta", "sku", "cantidad", "precio"], ...items]));
writeFileSync(
  join(salida, "LEEME.md"),
  `# ⚠️ DATOS SINTÉTICOS — NO SON VENTAS REALES

Generados con \`node data/scripts/generar_sintetico.mjs ${N_BOLETAS} ${SEMILLA}\` (determinista).

- ${boletas.length} boletas, ${items.length} líneas, ${N_CLIENTES} clientes ficticios (CLI-0001…).
- Periodo ${new Date(INICIO).toISOString().slice(0, 10)} a ${new Date(FIN).toISOString().slice(0, 10)}, Lun–Sáb 7:00–19:00 (hora de Lima, guardada en UTC).
- Cada boleta proviene de 1–2 "proyectos" de compra (pintar, agua fría, desagüe, baño, cableado, vaciado…)
  con complementos probabilísticos, según el perfil del cliente (pintor, gasfitero, electricista,
  maestro de obra, carpintero, hogar), más un 20 % de compras impulsivas aleatorias.
- Precios: precio de catálogo actual con una inflación lineal leve (90 % → 100 %).

En la base de datos se cargan con \`configuracion.fuente_datos = 'sintetico'\`.
`
);
console.log(`OK: ${boletas.length} boletas, ${items.length} ítems → data/sintetico/`);
