// Diseño responsive desde 360 px: ninguna página pública con desplazamiento horizontal.
import { expect, test } from "@playwright/test";

const RUTAS = ["/", "/busqueda?q=pintar", "/busqueda?categoria=Electricidad", "/detalle/PIN-001", "/carrito", "/confirmar", "/mi-cuenta", "/login", "/ayuda/faq", "/libro-reclamaciones", "/admin/login"];

for (const ruta of RUTAS) {
  test(`sin desborde horizontal a 360 px: ${ruta}`, async ({ page }) => {
    await page.goto(ruta);
    await page.waitForLoadState("networkidle");
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(360);
  });
}
