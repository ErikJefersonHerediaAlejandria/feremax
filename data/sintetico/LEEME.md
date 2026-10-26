# ⚠️ DATOS SINTÉTICOS — NO SON VENTAS REALES

Generados con `node data/scripts/generar_sintetico.mjs 5000 2026` (determinista).

- 5000 boletas, 13556 líneas, 900 clientes ficticios (CLI-0001…).
- Periodo 2024-01-02 a 2026-09-30, Lun–Sáb 7:00–19:00 (hora de Lima, guardada en UTC).
- Cada boleta proviene de 1–2 "proyectos" de compra (pintar, agua fría, desagüe, baño, cableado, vaciado…)
  con complementos probabilísticos, según el perfil del cliente (pintor, gasfitero, electricista,
  maestro de obra, carpintero, hogar), más un 20 % de compras impulsivas aleatorias.
- Precios: precio de catálogo actual con una inflación lineal leve (90 % → 100 %).

En la base de datos se cargan con `configuracion.fuente_datos = 'sintetico'`.
