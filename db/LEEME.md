# Base de datos FerreMax v2 en Supabase

## Archivos

| Archivo | Qué es |
|---|---|
| `ferremax_v2.sql` | Base completa (esquema + datos): 52 productos, configuración, 5.000 boletas **sintéticas** (13.556 ítems), RLS activado en las 13 tablas y registro de migraciones de Prisma. **No** trae administradores. |
| `exportar.mjs` | Script que regenera `ferremax_v2.sql` a partir de un `pg_dump` de la base local. |

Para regenerarlo:
```bash
pg_dump -h localhost -p 5433 -U ferremax -d ferremax_dev --no-owner --no-privileges --inserts --rows-per-insert=500 --schema=public -f raw.sql
node db/exportar.mjs raw.sql db/ferremax_v2.sql
```

## 1. Crear el proyecto

1. Entra a <https://supabase.com/dashboard> → **New project**.
2. **Name:** `ferremax`.
3. **Database password:** pulsa *Generate a password* y **guárdala** (no se puede volver a ver).
4. **Region:** **South America (São Paulo)** — `sa-east-1`.
5. **Plan:** *Free* sirve para desarrollo. Ojo: un proyecto Free se **pausa tras 7 días sin uso**. Para las sesiones
   con participantes conviene *Pro*, o entrar al panel antes de cada jornada.
6. **Create new project** y espera ~2 minutos.

## 2. Obtener las cadenas de conexión

Botón **Connect** (arriba en el proyecto) → pestaña **ORMs** o **Connection string**:

| Variable | Cuál copiar | Forma |
|---|---|---|
| `DATABASE_URL` (la usa la app) | **Transaction pooler** (puerto **6543**) | `postgresql://postgres.<ref>:<CONTRASEÑA>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres` |
| `DIRECT_URL` (la usan las migraciones) | **Session pooler** (puerto **5432**) | `postgresql://postgres.<ref>:<CONTRASEÑA>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres` |

Reemplaza `[YOUR-PASSWORD]` por la contraseña del paso 1. Si contiene caracteres especiales (`@ # / : ?`), codifícalos
en URL (por ejemplo `@` → `%40`).

> Se usa *Session pooler* en vez de *Direct connection* porque la conexión directa (`db.<ref>.supabase.co`) solo
> funciona por IPv6, y la mayoría de redes domésticas y Render usan IPv4.

## 3. Cargar la base (elige una opción)

**Opción A — psql (recomendada; ya lo tienes instalado):**
```bash
psql "<DIRECT_URL>" -v ON_ERROR_STOP=1 -f C:\Users\ErikH\Downloads\Prueba\db\ferremax_v2.sql
```

**Opción B — SQL Editor:** *SQL Editor* → *New query* → pega todo el contenido de `ferremax_v2.sql` → **Run**.
(Si el editor reclama por el tamaño, ~850 KB, usa la opción A.)

**Opción C — dejar que lo haga Claude:** con las variables del paso 2, ejecuto `prisma migrate deploy` + seed
(queda igual que las opciones A/B, pero incluye el admin).

Comprueba en *Table Editor*: `productos` = 52 filas, `boletas` = 5.000, `configuracion` = 1.

## 4. Crear el administrador del panel

El SQL no trae admins a propósito. Desde `backend/`, con la `DIRECT_URL` de Supabase:
```powershell
$env:DATABASE_URL="<DIRECT_URL>"; $env:DIRECT_URL="<DIRECT_URL>"; $env:ADMIN_USERNAME="admin"; $env:ADMIN_PASSWORD="<una contraseña fuerte>"
npm run db:seed
```
El seed es idempotente: no duplica productos ni boletas, solo crea el admin si no existe.

## 5. Bucket para los modelos entrenados

*Storage* → **New bucket** → nombre **`modelos`** → **Public bucket: desactivado** → *Create*.

## 6. Claves para el recommender (sube los modelos al bucket)

*Project Settings* → **API Keys**:
- **Project URL**: `https://<ref>.supabase.co` → `SUPABASE_URL`
- **Secret key** (`sb_secret_…`, o la antigua *service_role*) → `SUPABASE_SECRET_KEY`. **Nunca** va en el frontend.

## 7. Seguridad (ya incluida)

- RLS activado en todas las tablas, sin políticas: la clave pública `anon` no puede leer ni escribir nada por la
  Data API. Prisma y el recommender conectan como `postgres`, que sí tiene acceso.
- Opcional: *Project Settings → Data API* → desactivar la Data API, porque FerreMax no la usa.
