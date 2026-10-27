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

## Fase 1
- **D-14 · Versiones.** Prisma **7.10.1** para `prisma`, `@prisma/client` y `@prisma/adapter-pg`. La etiqueta `latest`
  de `prisma` apunta a `8.0.0-rc.27`, que no es estable. NestJS 12 (ESM, Vitest, oxlint) y TypeScript 6.0.3, la
  versión que soporta `@nestjs/cli`.
- **D-15 · Zona horaria UTC forzada.** `@prisma/adapter-pg` envía los timestamps sin zona, y Postgres los interpretaba
  en la zona de la sesión (America/Bogota en este equipo), corriéndolos 5 h en la base. Toda conexión fija
  `-c timezone=UTC` (`opcionesPg()` en `prisma/scripts/lib.ts`). Un test de integración lo vigila.
- **D-16 · PostgreSQL local de desarrollo.** Clúster propio del proyecto en `.pgdata/` (puerto 5433, usuario `ferremax`,
  autenticación trust solo en localhost), con las bases `ferremax_dev` y `ferremax_test`. No toca el Postgres del
  sistema (5432). Supabase se usará en la Fase 6.
- **D-17 · `DIRECT_URL` para el CLI y `DATABASE_URL` para la app**, como recomienda Supabase (pooler 6543 / directo 5432).
- **D-18 · Tablas adicionales:** `evaluaciones_offline` (guarda cada corrida, como pide la Fase 2) y
  `sesiones_evaluacion.token_dispositivo`, porque v1 vincula el navegador del participante con ese token
  (cabecera `x-sesion-evaluacion`).
- **D-19 · Clientes.** No hay tabla `clientes`: el panel los deriva de boletas, pedidos y sesiones, como hace v1 en
  `/admin/dashboard`.
- **D-20 · Seed.** Es idempotente y no pisa el `stock` de productos existentes, para no deshacer las ventas. Las boletas
  sintéticas se cargan solo si la tabla está vacía.
- **D-21 · Formato del respaldo v1** (desconocido): una carpeta con `productos|boletas|boleta_items|reglas|sesiones|
  eventos|pedidos|pedido_items|configuracion` en `.json` o `.csv`, con los nombres de campo de v1. Las fechas sin zona
  se toman como UTC. Hay un ejemplo en `backend/test/fixtures/respaldo-v1/`.
- **D-22 · RLS en Supabase.** La migración `rls_supabase` activa RLS sin políticas en todas las tablas, para que la Data
  API de Supabase (clave `anon`) no exponga datos. Agrega también `CHECK (id = 1)` en `configuracion`.
- **D-23 · Respaldo SQL.** `db/ferremax_v2.sql` (INSERTs y una sola transacción) sirve para el SQL Editor o psql. No
  incluye administradores.
- **D-24 · Reconstrucción en Supabase (2026-10-26, con aprobación del usuario).** El *Table Editor* había creado 4
  tablas a partir de los CSV, con tipos inferidos (sin PK/FK, `double precision` en precios, `bigint` en
  `peso_contenido`). Se borraron, se ejecutó `prisma migrate deploy` (13 tablas) y el seed. Antes y después:
  52 productos, 5.000 boletas, 13.556 ítems, venta S/ 1.046.271,80 y stock 981.
- **D-25 · Credenciales de Supabase** en `backend/.env.supabase` (ignorado por git), con plantilla en
  `.env.supabase.example`. Los scripts `db:*:supabase` las cargan con `node --env-file`. El `.env` por defecto sigue
  apuntando a la base local, para no tocar Supabase por accidente.

## Fase 2
- **D-26 · Respuesta de `/recomendar`.** Devuelve `ProductoPuntuado[]` completo. El catálogo (precio, stock, activo)
  se lee de la base con una caché de 30 s, y `POST /recargar` la invalida.
- **D-27 · Puntajes.** En CONV, `puntaje` = confianza × lift de la mejor regla activa, para que sea coherente con el
  orden. En ML, es la probabilidad del reordenador. En popularidad es `null`, como en v1.
- **D-28 · `peso_contenido`** multiplica las 3 variables de contenido antes de puntuar (1 = neutro, valor usado al
  entrenar). **`variante_ml`:** `COMPLETO` (16 variables) o `REGLAS` (8 variables, candidatos de reglas y
  popularidad). Cada reentrenamiento entrena las dos variantes.
- **D-29 · Validación del reordenador.** Reglas, CF y popularidad del 90 % más antiguo, AP sobre el 10 % final.
  Luego se reaprenden reglas, CF y popularidad con el 100 % para servir, y se conserva el reordenador validado.
- **D-30 · Protocolo offline "dado uno"** (contexto = 1 producto, relevantes = el resto de la boleta) sobre el 10 %
  final. Se incluye `POPULARIDAD` como referencia y McNemar exacto entre cada par de modos.
- **D-31 · Historial del cliente.** El recommender lo usa (B = historial ∪ carrito) solo cuando el backend le pasa
  `codigo_cliente`. El backend decide si puede pasarlo, igual que en v1: solo con el token de la sesión activa de ese
  cliente.
- **D-32 · Sin reglas o sin modelo** (base recién creada), el modo ML se comporta como CONV, y si tampoco hay reglas,
  como popularidad. `/health` informa la versión del modelo.
- **D-33 · Artefactos.** `joblib` en `recommender/artefactos/` y, si hay `SUPABASE_URL` y `SUPABASE_SECRET_KEY`, en el
  bucket privado `modelos`. `modelos.artefacto` guarda `local://…` o `storage://modelos/…`.
- **D-34 · Sinónimos.** "pared" solo se expande a "tarugo": expandirla a pinturas desviaba búsquedas como "colgar un
  cuadro en la pared".

## Fase 3
- **D-35 · Formato de errores de v1 (FastAPI):** `{"detail": …}`. Los 422 llevan `loc` con su origen
  (`body`/`query`/`path`); `PipeValidacion` envuelve `ValidationPipe` con `whitelist` + `forbidNonWhitelisted`.
- **D-36 · Sin token de sesión válido**, eventos y pedidos se guardan con `id_sesion = "SIN-SESION"` y la condición
  de `modo_activo`. Con token, la sesión fija `id_sesion`, `codigo_cliente`, `escenario` y la condición. Así un
  cliente no puede contaminar las métricas de otra sesión.
- **D-37 · Una sola sesión activa a la vez** (409 si hay otra). Los IDs son `SES-0001`, `SES-0002`… y el token es
  aleatorio de 192 bits.
- **D-38 · `GET /api/admin/config` público** devuelve solo `{k, fuente_datos}`: no revela la condición al
  participante. Con cookie de admin devuelve la configuración completa (cambia respecto de v1; ver D-13).
- **D-39 · `base` en `/recomendar/cliente`:** `HISTORIAL_Y_CARRITO` si se usó el historial; si no, `SIN_HISTORIAL`.
- **D-40 · Métricas de sesión (capa 2):** "lista" = `RECOM_MOSTRADA` con el mismo timestamp; P@5 = media por lista de
  aciertos / 5; aceptada = producto mostrado en el top 5 y comprado con origen `RECOMENDACION`. McNemar se calcula
  pareado por participante con la última sesión válida y completa de cada condición.
- **D-41 · Rutas nuevas (no rompen v1):** `/api/health`, `POST /api/admin/logout`, `/api/docs` (fuera de producción).
- **D-42 · Pedido:** se fusionan las líneas repetidas del mismo SKU. Se usa un descuento condicional
  (`stock >= cantidad`) dentro de la transacción, así que nunca queda stock negativo.
- **D-43 · Cliente Prisma generado en `src/generated/prisma`**, para que `nest build` lo compile.
