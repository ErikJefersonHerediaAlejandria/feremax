// Integración de la Fase 1: migración + seed idempotente + importación del respaldo v1, sobre la BD de pruebas.
import { execSync } from 'node:child_process';
import pg from 'pg';

const URL_TEST =
  process.env.TEST_DATABASE_URL ??
  'postgresql://ferremax@localhost:5433/ferremax_test?schema=public';
const env = {
  ...process.env,
  DATABASE_URL: URL_TEST,
  DIRECT_URL: URL_TEST,
  ADMIN_PASSWORD: 'test-pass',
};
const run = (cmd: string) =>
  execSync(cmd, { env, encoding: 'utf8', stdio: 'pipe' });

const db = new pg.Client({ connectionString: URL_TEST.replace(/\?.*$/, '') });
const contar = async (tabla: string) =>
  Number((await db.query(`select count(*) from ${tabla}`)).rows[0].count);

beforeAll(async () => {
  run('npx prisma migrate deploy');
  await db.connect();
  await db.query(`truncate productos, boletas, boleta_items, configuracion, reglas_asociacion, modelos,
    evaluaciones_offline, sesiones_evaluacion, eventos, pedidos, pedido_items, admins restart identity cascade`);
}, 120_000);
afterAll(() => db.end());

describe('seed', () => {
  it('carga catálogo, configuración, admin y boletas sintéticas, y es idempotente', async () => {
    run('npx tsx prisma/seed.ts');
    await db.query("update productos set stock = 999 where sku = 'VAL-002'");
    run('npx tsx prisma/seed.ts');
    expect(await contar('productos')).toBe(52);
    expect(await contar('configuracion')).toBe(1);
    expect(await contar('admins')).toBe(1);
    expect(await contar('boletas')).toBe(5000);
    expect(await contar('boleta_items')).toBe(13556);
    // El segundo seed no pisa el stock vendido
    expect(
      (await db.query("select stock from productos where sku='VAL-002'"))
        .rows[0].stock,
    ).toBe(999);
    const c = (await db.query('select * from configuracion')).rows[0];
    expect(c).toMatchObject({
      id: 1,
      modo_activo: 'ML',
      k: 5,
      soporte_min: 0.01,
      confianza_min: 0.15,
      lift_min: 1.2,
      variante_ml: 'COMPLETO',
      fuente_datos: 'sintetico',
    });
    expect(
      (await db.query('select password_hash from admins')).rows[0]
        .password_hash,
    ).toMatch(/^\$argon2id\$/);
  }, 120_000);
});

describe('importar-v1', () => {
  it('importa el respaldo de ejemplo dos veces sin duplicar', async () => {
    run('npx tsx prisma/scripts/importar-v1.ts test/fixtures/respaldo-v1');
    run('npx tsx prisma/scripts/importar-v1.ts test/fixtures/respaldo-v1');
    expect(await contar('reglas_asociacion')).toBe(2);
    expect(await contar('sesiones_evaluacion')).toBe(2);
    expect(await contar('eventos')).toBe(2);
    expect(await contar('pedidos')).toBe(1);
    expect(await contar('pedido_items')).toBe(2);
    const r = (
      await db.query(
        'select antecedente, consecuente from reglas_asociacion order by id',
      )
    ).rows;
    expect(r[1]).toEqual({
      antecedente: ['PIN-001', 'FER-003'],
      consecuente: ['PIN-007'],
    });
    const s = (
      await db.query(
        "select inicio, completa from sesiones_evaluacion where id_sesion='SES-0001'",
      )
    ).rows[0];
    expect(s.inicio.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(s.completa).toBe(true);
  }, 120_000);
});
