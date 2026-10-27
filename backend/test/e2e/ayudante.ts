// Utilidades de los tests e2e: app Nest real contra la BD de pruebas, con el recommender sustituido por un doble.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import request from 'supertest';
import { configurarApp } from '../../src/app.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/comun/prisma.service.js';
import {
  PeticionRecomendar,
  ProductoPuntuado,
  Recommender,
} from '../../src/comun/recommender.client.js';

export const URL_TEST =
  process.env.TEST_DATABASE_URL ??
  'postgresql://ferremax@localhost:5433/ferremax_test?schema=public';
export const ADMIN = { username: 'admin', password: 'test-pass-e2e' };
export const CAMPOS_PRODUCTO = [
  'sku',
  'nombre',
  'marca',
  'categoria',
  'subcategoria',
  'unidad',
  'uso',
  'precio',
  'stock',
];

/** Doble del recommender: respuestas deterministas y registro de llamadas. */
export class RecommenderFalso extends Recommender {
  llamadas: { metodo: string; args: unknown }[] = [];

  private producto(
    sku: string,
    posicion: number,
    fuente: string,
  ): ProductoPuntuado {
    return {
      sku,
      nombre: `Producto ${sku}`,
      marca: null,
      categoria: null,
      subcategoria: null,
      unidad: 'Und',
      uso: null,
      precio: 10,
      stock: 5,
      puntaje: 0.5,
      terminos: [],
      fuente,
      posicion,
    };
  }

  async recomendar(p: PeticionRecomendar) {
    this.llamadas.push({ metodo: 'recomendar', args: p });
    return ['ACC-001', 'ACC-004', 'VAL-002', 'PIN-007', 'FER-003']
      .filter((s) => !p.skus.includes(s))
      .slice(0, p.k)
      .map((s, i) =>
        this.producto(s, i + 1, p.modo === 'ML' ? 'REORDENADOR' : 'REGLA'),
      );
  }

  async buscarNecesidad(texto: string, k: number) {
    this.llamadas.push({ metodo: 'buscarNecesidad', args: { texto, k } });
    return [
      { ...this.producto('PIN-001', 1, 'CONTENIDO'), terminos: ['pintura'] },
    ];
  }

  async reentrenar() {
    this.llamadas.push({ metodo: 'reentrenar', args: null });
    return {
      status: 'ok',
      message: 'Modelo falso entrenado',
      comprobantes: 5000,
    };
  }

  async evaluacionOffline() {
    this.llamadas.push({ metodo: 'evaluacionOffline', args: null });
    return { modos: ['CONV', 'ML_COMPLETO'], por_modo: {} };
  }

  async recargar() {
    this.llamadas.push({ metodo: 'recargar', args: null });
  }

  async salud() {
    return true;
  }

  ultima(metodo: string) {
    return [...this.llamadas].reverse().find((l) => l.metodo === metodo)
      ?.args as Record<string, unknown> | undefined;
  }
}

export async function crearApp() {
  const recommender = new RecommenderFalso();
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Recommender)
    .useValue(recommender)
    .compile();
  const app: INestApplication = configurarApp(
    modulo.createNestApplication({ logger: false }),
  );
  await app.init();
  return {
    app,
    recommender,
    prisma: app.get(PrismaService),
    http: () => request(app.getHttpServer()),
  };
}

/** Deja la BD de pruebas como recién sembrada (migraciones + seed). */
export async function reiniciarBD(prisma: PrismaService) {
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'pipe' });
  await prisma.$executeRawUnsafe(`truncate productos, boletas, boleta_items, configuracion, reglas_asociacion, modelos,
    evaluaciones_offline, sesiones_evaluacion, eventos, pedidos, pedido_items, admins restart identity cascade`);
  execSync('npx tsx prisma/seed.ts', { env: process.env, stdio: 'pipe' });
}

export async function cookieAdmin(app: INestApplication) {
  const res = await request(app.getHttpServer())
    .post('/api/admin/login')
    .send(ADMIN)
    .expect(200);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0];
  return cookie.split(';')[0];
}
