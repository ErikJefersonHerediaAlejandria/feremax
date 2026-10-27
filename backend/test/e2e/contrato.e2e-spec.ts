// Todas las rutas del contrato v1 (docs/openapi-v1.json) existen en v2 con el mismo método.
import { readFileSync } from 'node:fs';
import type { Test } from 'supertest';
import { crearApp } from './ayudante.js';

const openapi = JSON.parse(readFileSync('../docs/openapi-v1.json', 'utf8')) as {
  paths: Record<string, Record<string, unknown>>;
};
const RUTAS = Object.entries(openapi.paths).flatMap(([ruta, metodos]) =>
  Object.keys(metodos).map((m) => [m, ruta] as const),
);
const EJEMPLOS: Record<string, string> = {
  '{sku}': 'VAL-002',
  '{codigo}': 'CLI-0001',
};

let ctx: Awaited<ReturnType<typeof crearApp>>;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.app.close());

it('el contrato v1 tiene 25 operaciones', () => {
  expect(RUTAS).toHaveLength(25);
});

it.each(RUTAS)('%s %s existe en v2', async (metodo, ruta) => {
  const url = ruta.replace(/\{\w+\}/g, (p) => EJEMPLOS[p]);
  const http = ctx.http() as unknown as Record<string, (u: string) => Test>;
  const r = await http[metodo](url).send({});
  const noExiste = r.status === 404 && r.body?.detail === 'Not Found';
  expect(noExiste, `${metodo.toUpperCase()} ${ruta} → ${r.status}`).toBe(false);
});
