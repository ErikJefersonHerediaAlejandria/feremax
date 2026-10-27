// Toma capturas de pantalla de la tienda (escritorio y móvil 360 px) en la carpeta capturas/.
// Requiere el entorno levantado (npm run dev). Uso: npm run capturas [-- /ruta1 /ruta2 ...]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const salida = resolve(import.meta.dirname, "..", "capturas");
mkdirSync(salida, { recursive: true });

const rutas = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/", "/busqueda?q=pintar%20una%20pared", "/busqueda?categoria=Gasfiter%C3%ADa", "/detalle/PIN-001", "/carrito", "/confirmar", "/mi-cuenta", "/login", "/ayuda/faq"];

const nombre = (ruta) => (ruta === "/" ? "inicio" : ruta.replace(/^\//, "").replace(/[?=&%/]+/g, "_")).slice(0, 60);

const navegador = await chromium.launch();
for (const [disp, viewport] of [
  ["escritorio", { width: 1366, height: 900 }],
  ["movil", { width: 360, height: 780 }],
]) {
  const contexto = await navegador.newContext({ viewport, locale: "es-PE", deviceScaleFactor: 1 });
  const pagina = await contexto.newPage();
  // Carrito de ejemplo para que /carrito y /confirmar no salgan vacíos.
  await pagina.goto(BASE);
  await pagina.evaluate(() =>
    localStorage.setItem(
      "ferremax_carrito",
      JSON.stringify([
        { sku: "PIN-001", nombre: "Pintura látex blanca 1 galón", marca: "Vencedor", categoria: "Pinturas y Acabados", unidad: "Gal", precio: 48, stock: 2, cantidad: 1, origen: "BUSQUEDA", posicion_recom: null },
        { sku: "PIN-007", nombre: "Imprimante para paredes 1 galón", marca: "Vencedor", categoria: "Pinturas y Acabados", unidad: "Gal", precio: 34, stock: 9, cantidad: 2, origen: "RECOMENDACION", posicion_recom: 1 },
      ]),
    ),
  );
  for (const ruta of rutas) {
    await pagina.goto(BASE + ruta, { waitUntil: "networkidle" });
    await pagina.waitForTimeout(600);
    const archivo = join(salida, `${nombre(ruta)}-${disp}.png`);
    await pagina.screenshot({ path: archivo, fullPage: true });
    const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`${desborde ? "⚠ DESBORDE HORIZONTAL " : ""}${archivo}`);
  }
  // Panel admin (solo si se da la contraseña: ADMIN_PASSWORD=... npm run capturas)
  if (process.env.ADMIN_PASSWORD && !process.argv.slice(2).length) {
    await pagina.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
    await pagina.getByLabel(/usuario/i).fill(process.env.ADMIN_USERNAME ?? "admin");
    await pagina.getByLabel(/contraseña/i).fill(process.env.ADMIN_PASSWORD);
    await pagina.locator("form button[type=submit]").click();
    await pagina.waitForURL(/\/admin\/(resumen|recomendador)/);
    for (const r of ["resumen", "inventario", "pedidos", "clientes", "eventos", "recomendador", "evaluacion", "configuracion"]) {
      await pagina.goto(`${BASE}/admin/${r}`, { waitUntil: "networkidle" });
      await pagina.waitForTimeout(800);
      const archivo = join(salida, `admin-${r}-${disp}.png`);
      await pagina.screenshot({ path: archivo, fullPage: true });
      const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      console.log(`${desborde ? "⚠ DESBORDE HORIZONTAL " : ""}${archivo}`);
    }
  }
  await contexto.close();
}
await navegador.close();
