// Recorrido del participante: búsqueda → detalle → carrito con complemento recomendado → confirmar → pedido
// registrado. Se ejecuta en cada condición y verifica que los eventos y el pedido quedan con esa condición.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:4000";
const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "ferremax-dev" };

interface Evento {
  tipo_evento: string;
  id_sesion: string;
  codigo_cliente: string;
  condicion: string;
  sku: string | null;
  origen: string | null;
  posicion_recom: number | null;
  timestamp: number;
}

async function loginAdmin(request: APIRequestContext) {
  const r = await request.post(`${API}/api/admin/login`, { data: ADMIN });
  expect(r.ok(), "login de admin (define ADMIN_PASSWORD si no es el de desarrollo)").toBeTruthy();
}

async function iniciarSesion(request: APIRequestContext, condicion: "CONV" | "ML") {
  const r = await request.post(`${API}/api/admin/sesiones`, {
    data: { codigo_cliente: "CLI-0007", escenario: `E2E · ${condicion}`, condicion, orden: condicion === "CONV" ? "A" : "B" },
  });
  expect(r.status(), `iniciar sesión (409 = ya hay otra sesión activa): ${await r.text()}`).toBe(200);
  return (await r.json()) as { sesion: { id_sesion: string }; token_dispositivo: string };
}

/** Respuesta del recomendador que dispara la página (para comprobar qué motor respondió). */
const respuestaRecomendar = (page: Page) => page.waitForResponse((r) => /\/api\/recomendar(\/carrito|\?)/.test(r.url()) && r.request().method() !== "OPTIONS");

for (const condicion of ["CONV", "ML"] as const) {
  test(`compra completa con recomendación · condición ${condicion}`, async ({ page, request }) => {
    await loginAdmin(request);
    const { sesion, token_dispositivo } = await iniciarSesion(request, condicion);
    const id = sesion.id_sesion;

    try {
      // Este navegador queda vinculado como dispositivo del participante (como al iniciar la sesión en el panel).
      await page.addInitScript(
        ([idSesion, token]) => {
          if (!sessionStorage.getItem("e2e-inicializado")) {
            localStorage.setItem("ferremax_sesion_eval", JSON.stringify({ id_sesion: idSesion, token }));
            localStorage.removeItem("ferremax_carrito");
            sessionStorage.setItem("e2e-inicializado", "1");
          }
        },
        [id, token_dispositivo],
      );

      // 1. Búsqueda por necesidad
      await page.goto("/");
      const buscador = page.getByRole("search").first();
      await buscador.getByRole("searchbox").fill("necesito pintar la pared de mi sala");
      await buscador.getByRole("button", { name: "Buscar" }).click();
      await expect(page).toHaveURL(/\/busqueda\?q=/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("pintar la pared");
      const resultado = page.locator('section[aria-label="Resultados"] article').filter({ hasText: "En stock" }).first();
      await expect(resultado).toBeVisible();

      // 2. Detalle y "Agregar al carrito"
      const recosDetalle = respuestaRecomendar(page);
      await resultado.getByRole("heading").getByRole("link").click();
      await expect(page).toHaveURL(/\/detalle\/.+origen=BUSQUEDA/);
      const skuPrincipal = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
      await page.getByRole("button", { name: "Agregar al carrito" }).click();
      await expect(page.getByRole("status").filter({ hasText: "agregado al carrito" })).toBeVisible();

      // Las recomendaciones se piden al acercarse a la pantalla (como las vería el participante)
      await page.locator("#recos-detalle").scrollIntoViewIfNeeded();
      // El recomendador respondió con el motor de la condición de la sesión
      const recomendados = (await (await recosDetalle).json()) as { fuente: string }[];
      expect(recomendados.length).toBeGreaterThan(0);
      if (condicion === "ML") expect(recomendados[0].fuente).toBe("REORDENADOR");
      else expect(recomendados[0].fuente).toMatch(/^(REGLA|POPULAR_CATEGORIA|POPULARIDAD)$/);

      // 3. Carrito: "Complementa tu compra" con selección múltiple
      const recosCarrito = respuestaRecomendar(page);
      await page.goto("/carrito");
      await page.locator("#recos-carrito").scrollIntoViewIfNeeded();
      await recosCarrito;
      const complementos = page.locator("section").filter({ has: page.getByRole("heading", { name: "Complementa tu compra" }) });
      const casilla = complementos.getByRole("checkbox").and(page.locator(":not([disabled])")).first();
      await casilla.check();
      await complementos.getByRole("button", { name: "Agregar seleccionados" }).click();
      await expect(page.locator('section[aria-label="Productos del carrito"] li')).toHaveCount(2);

      // 4. Confirmar
      await page.getByRole("link", { name: /Continuar con el pedido/ }).click();
      await expect(page.locator("#codigo-cliente")).toHaveValue("CLI-0007");
      await page.getByLabel(/Recojo en tienda/).check();
      await page.getByLabel("Plin").check();
      await page.getByRole("button", { name: /Realizar pedido/ }).click();

      // 5. Pedido registrado
      await expect(page).toHaveURL(/\/pedido-registrado/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/¡Pedido N° \d{6} registrado!/);
      await expect(page.getByText("Medio de pago: Plin")).toBeVisible();

      // Eventos registrados: todos con la sesión y la condición correctas
      const eventos = (await (await request.get(`${API}/api/admin/eventos?id_sesion=${id}`)).json()) as Evento[];
      const tipos = new Set(eventos.map((e) => e.tipo_evento));
      for (const t of ["INICIO_BUSQUEDA", "CONSULTA", "RECOM_MOSTRADA", "VER_DETALLE", "PRODUCTO_AGREGADO", "CONFIRMACION_CARRITO"]) {
        expect(tipos, `falta el evento ${t}`).toContain(t);
      }
      expect(eventos.every((e) => e.condicion === condicion && e.id_sesion === id && e.codigo_cliente === "CLI-0007")).toBe(true);
      const agregadoRecomendado = eventos.find((e) => e.tipo_evento === "PRODUCTO_AGREGADO" && e.origen === "RECOMENDACION");
      expect(agregadoRecomendado?.posicion_recom).toBeGreaterThanOrEqual(1);
      expect(eventos.find((e) => e.tipo_evento === "PRODUCTO_AGREGADO" && e.origen === "BUSQUEDA")?.sku).toBe(skuPrincipal);
      // Las listas mostradas comparten timestamp (así las agrupan los indicadores)
      const listas = new Set(eventos.filter((e) => e.tipo_evento === "RECOM_MOSTRADA").map((e) => e.timestamp));
      expect(listas.size).toBeGreaterThanOrEqual(2);

      // El pedido quedó con la condición de la sesión y un ítem que vino de una recomendación
      const dashboard = (await (await request.get(`${API}/api/admin/dashboard`)).json()) as { pedidos: { id_sesion: string; condicion: string; pago: string }[] };
      expect(dashboard.pedidos.find((p) => p.id_sesion === id)).toMatchObject({ condicion, pago: "Plin" });

      // Indicadores: la sesión aparece con al menos una recomendación aceptada
      await request.put(`${API}/api/admin/sesiones`, { data: { id_sesion: id, valida: true } });
      const ind = (await (await request.get(`${API}/api/admin/indicadores`)).json()) as { por_sesion: Record<string, { id_sesion: string; recs_aceptadas: number; tiempo_s: number }[]> };
      const fila = ind.por_sesion[condicion].find((s) => s.id_sesion === id);
      expect(fila?.recs_aceptadas).toBeGreaterThanOrEqual(1);
      expect(fila?.tiempo_s).toBeGreaterThan(0);
    } finally {
      // Las sesiones de prueba quedan marcadas como inválidas para no contaminar los indicadores del experimento.
      await request.put(`${API}/api/admin/sesiones`, { data: { id_sesion: id, valida: false } });
    }
  });
}

test("el participante no ve la condición experimental", async ({ browser }) => {
  // Contexto nuevo, sin cookie de admin: la franja "Sesión de evaluación" no debe aparecer.
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /construir y renovar/ })).toBeVisible();
  await expect(page.getByText(/Sesión de evaluación|Condición|Modo administrador/)).toHaveCount(0);
  const config = await (await page.request.get(`${API}/api/admin/config`)).json();
  expect(config).not.toHaveProperty("modo_activo");
  await contexto.close();
});
