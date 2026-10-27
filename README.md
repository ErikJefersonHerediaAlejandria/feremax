# FerreMax v2

Tienda en línea de ferretería ("Venta directa & mayorista", Lima, Perú). Es el prototipo de la **tesis UPN 2026**, que
compara dos motores de recomendación:

- **CONV**: reglas de asociación.
- **ML**: reglas, filtrado colaborativo y popularidad, reordenados con LightGBM.

## Arquitectura

```
Navegador ─► frontend/     Next.js 16 (App Router, Tailwind 4)      sosdigital.lat        (Vercel)
                │
                ▼
             backend/      NestJS 12 + Prisma 7                     api.sosdigital.lat    (Render)
                │   ├─► PostgreSQL (Supabase)
                │   └─► recommender/  FastAPI + LightGBM (privado, X-Internal-Key)        (Render)
                ▼
             data/         catálogo v1, imágenes, boletas SINTÉTICAS
```

| Carpeta | Contenido |
|---|---|
| `frontend/` | Tienda y panel `/admin`. El catálogo y el detalle se renderizan en el servidor (SEO, sitemap); el carrito vive en el navegador. |
| `backend/` | API pública y de administración, compatible con el contrato v1 (`docs/openapi-v1.json`). |
| `recommender/` | Minería de reglas (FP-Growth), CF ítem-ítem, reordenador LightGBM, búsqueda TF-IDF y evaluación offline. |
| `data/` | `seed/` (catálogo de v1), `sintetico/` (5.000 boletas generadas) y `scripts/`. |
| `db/` | Respaldo SQL y CSV para Supabase, con la guía en `db/LEEME.md`. |
| `docs/` | `api.md` (contrato), `recomendador.md` (metodología) y `openapi-v1.json` (contrato de v1). |

## Cómo verlo funcionar en tu PC

**Requisitos (ya instalados en el equipo de desarrollo):**
- Node 24
- PostgreSQL 18 (binarios en `C:\Program Files\PostgreSQL\18\bin`)
- [uv](https://docs.astral.sh/uv/) para Python 3.12

**La primera vez, instala las dependencias:**

```powershell
cd C:\Users\ErikH\Downloads\Prueba
npm install                       # Playwright (capturas y pruebas de punta a punta)
cd backend;     npm install; cd ..
cd frontend;    npm install; cd ..
cd recommender; uv sync;     cd ..
```

**Para levantar todo** (base de datos, recommender, API y web) con un solo comando:

```powershell
npm run dev
```

Luego abre en el navegador:

| Qué | URL |
|---|---|
| Tienda | <http://localhost:3000> |
| Panel admin | <http://localhost:3000/admin> (usuario `admin`; contraseña de desarrollo `ferremax-dev`) |
| API (Swagger) | <http://localhost:4000/api/docs> |

`Ctrl + C` detiene todo. La base local es el clúster del proyecto en `.pgdata/` (puerto 5433).

### Probar el experimento como participante

1. Entra a `/admin`, sección **Configuración**, e inicia una sesión: código de cliente, escenario, condición CONV o ML
   y orden A/B. Ese navegador queda vinculado como dispositivo del participante.
2. Abre la tienda. Como hay sesión de admin, verás arriba la franja **"Sesión de evaluación"** con la condición. El
   participante, sin sesión de admin, no la ve.
3. Busca, agrega productos y confirma el pedido.
4. En `/admin`, **Configuración**, finaliza la sesión como válida.
5. En **Evaluación** verás Precision@5, el tiempo de selección y McNemar. En **Registro de eventos** está cada evento,
   exportable a CSV.

### Capturas de pantalla automáticas

Con `npm run dev` corriendo, en otra terminal:

```powershell
$env:ADMIN_PASSWORD="ferremax-dev"; npm run capturas
```

Genera las capturas de escritorio y de móvil (360 px) de todas las pantallas en la carpeta `capturas/`, que puedes
abrir desde VS Code.

## Pruebas y calidad

| Qué | Comando (desde la raíz, con los servicios corriendo) |
|---|---|
| Punta a punta (Playwright) | `npm run e2e` (informe: `npm run e2e:informe`) |
| Paridad v1 ↔ v2 | `npm run paridad` (solo GET a sosdigital.lat) |
| Lighthouse (móvil, mediana de 3) | `npm run lighthouse` (frontend con `next build` + `next start`) |

| App | Comandos |
|---|---|
| backend | `npm run lint`, `npm run build`, `npm test` (unitarios), `npx vitest run --config ./vitest.config.e2e.ts` (e2e contra `ferremax_test`) |
| recommender | `uv run ruff check .`, `uv run pytest` |
| frontend | `npm run lint`, `npm run typecheck`, `npx next build` (necesita el API corriendo: prerenderiza el catálogo) |

El CI (`.github/workflows/ci.yml`) corre todo lo anterior en cada push.

## Variables de entorno

Cada app tiene su `.env.example`:

| App | Variables |
|---|---|
| backend | `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RECOMMENDER_URL`, `RECOMMENDER_KEY`, `FRONTEND_ORIGIN`, `ADMIN_USERNAME`/`ADMIN_PASSWORD` (seed), `COOKIE_SECURE`, `THROTTLE_*` |
| recommender | `DATABASE_URL`, `RECOMMENDER_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BUCKET_MODELOS`, `SEMILLA` |
| frontend | `NEXT_PUBLIC_API_URL`, `API_URL_INTERNA`, `NEXT_PUBLIC_SITE_URL`, `API_PROXY_URL` (opcional) |

Las credenciales de Supabase van en `backend/.env.supabase`, que está ignorado por git.

## Despliegue (planes gratuitos)

| Servicio | Dónde | Cómo |
|---|---|---|
| Base de datos | Supabase | Ya creada; migraciones con `npm run db:deploy:supabase` desde `backend/` |
| recommender y API | Render | **New → Blueprint** con este repositorio (lee `render.yaml`) |
| Tienda | Vercel | Importar el repositorio con *Root Directory* `frontend` |

En el plan gratuito de Render los servicios duermen tras 15 min sin uso: abre la tienda un par de minutos antes de
cada sesión de evaluación. Detalles en `DECISIONES.md` (D-61).

Las decisiones de diseño tomadas durante el desarrollo están en [`DECISIONES.md`](DECISIONES.md).
