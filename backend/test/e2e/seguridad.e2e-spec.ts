import { ADMIN, crearApp } from './ayudante.js';

// Límites bajos para poder comprobarlos (se leen en cada petición).
process.env.THROTTLE_LOGIN = '3';
process.env.THROTTLE_EVENTOS = '4';

let ctx: Awaited<ReturnType<typeof crearApp>>;

beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(async () => {
  await ctx.app.close();
  delete process.env.THROTTLE_LOGIN;
  delete process.env.THROTTLE_EVENTOS;
});

describe('seguridad y operación', () => {
  it('CORS solo permite el dominio del frontend, con credenciales', async () => {
    const ok = await ctx
      .http()
      .options('/api/productos')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const malo = await ctx
      .http()
      .options('/api/productos')
      .set('Origin', 'https://otro-sitio.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(malo.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('cabeceras de seguridad (helmet) y sin x-powered-by', async () => {
    const r = await ctx.http().get('/api/health').expect(200);
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  it('rate limiting en el login', async () => {
    for (let i = 0; i < 3; i++)
      await ctx
        .http()
        .post('/api/admin/login')
        .send({ ...ADMIN, password: 'mala' })
        .expect(401);
    const r = await ctx.http().post('/api/admin/login').send(ADMIN).expect(429);
    expect(r.body).toEqual({
      detail: 'Demasiadas solicitudes, intenta en un momento',
    });
  });

  it('rate limiting en las escrituras públicas, pero no en las lecturas', async () => {
    const e = {
      id_sesion: 'x',
      codigo_cliente: 'x',
      condicion: 'ML',
      tipo_evento: 'CONSULTA',
      timestamp: 1,
    };
    for (let i = 0; i < 4; i++)
      await ctx.http().post('/api/eventos').send(e).expect(200);
    await ctx.http().post('/api/eventos').send(e).expect(429);
    for (let i = 0; i < 10; i++)
      await ctx.http().get('/api/categorias').expect(200);
  });

  it('Swagger disponible fuera de producción', async () => {
    await ctx.http().get('/api/docs').expect(200);
  });

  it('Swagger deshabilitado en producción', async () => {
    const anterior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'secreto-de-pruebas-e2e-0123456789abcdef';
    try {
      const prod = await crearApp();
      await prod.http().get('/api/docs').expect(404);
      await prod.app.close();
    } finally {
      process.env.NODE_ENV = anterior;
    }
  });
});
