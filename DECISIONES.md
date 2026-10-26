# Decisiones

Registro de decisiones tomadas ante ambigüedades (la opción más simple, salvo motivo indicado).

## Fase 0
- **D-01 · Datos de entrenamiento sintéticos.** No se dispone del historial real ni del respaldo de la BD v1
  (confirmado por el usuario). Se generan 5.000 boletas sintéticas deterministas (`data/scripts/generar_sintetico.mjs`,
  semilla 2026) a partir del catálogo real de v1. Están en `data/sintetico/` con un `LEEME.md` que lo advierte, y se
  cargarán con `fuente_datos = 'sintetico'`. El script de importación v1 queda listo por si aparece el respaldo.
- **D-02 · Códigos de cliente sintéticos** con formato `CLI-0001`.
- **D-03 · Valores de `fuente`.** v1 devuelve `REGLA`, `POPULAR_CATEGORIA` y `REORDENADOR`, mientras que el prompt
  pide `REGLAS|CF|POPULARIDAD|REORDENADOR|CONTENIDO`. Como el contrato v1 manda, se conservan los valores de v1
  donde existen (`REGLA`, `POPULAR_CATEGORIA`) y se usan `CF`, `POPULARIDAD`, `CONTENIDO` para los nuevos.
- **D-04 · Imágenes.** Se copian las de v1 (`/img/productos/{sku}.webp`, `/img/categorias/*.webp`) a `data/seed/img/`;
  el frontend v2 las servirá como estáticos. `imagen_url` se llena con esa ruta.
- **D-05 · `/api/health`** no existe en v1 (404); se agrega en v2 como ruta nueva, sin romper el contrato.
- **D-06 · Respuestas de referencia.** Las respuestas GET reales de v1 se guardan en `docs/v1-respuestas/` para la
  prueba de paridad de la Fase 5.
- **D-07 · Tipos de evento.** v1 usa `INICIO_BUSQUEDA`, `CONSULTA`, `RECOM_MOSTRADA`, `PRODUCTO_AGREGADO`,
  `PRODUCTO_RETIRADO` y `CONFIRMACION_CARRITO` (este último lo registra el servidor). El prompt los nombra
  `busqueda, ver_detalle, agregar_carrito, click_recomendacion, quitar, confirmar`. Los indicadores de v1 dependen de
  los nombres v1, así que se conservan y se **añaden** `VER_DETALLE` y `CLIC_RECOMENDACION`, que faltaban.
  `origen` ∈ `CATEGORIA|BUSQUEDA|RECOMENDACION`.
- **D-08 · Layout único.** En v1 cada página repite su propio header y footer, con textos distintos. En v2 se unifica
  en un solo layout con los datos de marca del prompt: (01) 712 3456, contacto@ferremax.pe, Lun–Sáb 7:00 am – 7:00 pm.
- **D-09 · Páginas informativas.** En v1 son enlaces `#` sin contenido. En v2 se crean rutas reales
  (`/ayuda/faq`, `/ayuda/envios`, `/ayuda/privacidad`, `/ayuda/terminos`, `/libro-reclamaciones`) con textos propios
  de un prototipo.
- **D-10 · Indicador "Sesión de evaluación".** No existe en la tienda v1. Se agrega en v2 y solo es visible con la
  cookie de administrador; el participante no ve la condición.
- **D-11 · Autenticación del admin.** v1 guarda `admin_token` en localStorage y nunca llama a `/verificar`. v2 usa
  una cookie httpOnly y el guard llama a `GET /api/admin/verificar`. Para clientes no navegadores se sigue aceptando
  `Authorization: Bearer`, y `POST /login` sigue devolviendo `{token}` por compatibilidad.
- **D-12 · Costo de envío.** En v1 no hay costo ("Por coordinar" o "Sin costo") y el total no lo incluye. Se mantiene.
- **D-13 · `GET /api/admin/config` público.** v1 lo expone sin token (la tienda lo consulta cada 5 s). En v2 la misma ruta
  devuelve solo `{modo_activo, k, variante_ml, fuente_datos}` sin autenticación, y la configuración completa
  (umbrales y `reordenador`) cuando llega con la cookie o el token de administrador.
