import { ADMIN, cookieAdmin, crearApp, reiniciarBD } from './ayudante.js';

let ctx: Awaited<ReturnType<typeof crearApp>>;
let cookie: string;

beforeAll(async () => {
  ctx = await crearApp();
  await reiniciarBD(ctx.prisma);
  cookie = await cookieAdmin(ctx.app);
});
afterAll(() => ctx.app.close());

const RUTAS_ADMIN: [string, string][] = [
  ['get', '/api/admin/verificar'],
  ['put', '/api/admin/config'],
  ['get', '/api/admin/reglas'],
  ['post', '/api/admin/modelo/reentrenar'],
  ['get', '/api/admin/sesiones'],
  ['post', '/api/admin/sesiones'],
  ['put', '/api/admin/sesiones'],
  ['get', '/api/admin/eventos'],
  ['get', '/api/admin/indicadores'],
  ['get', '/api/admin/dashboard'],
  ['get', '/api/admin/evaluacion-offline'],
  ['post', '/api/admin/evaluacion-offline'],
];

describe('sin autenticación', () => {
  it.each(RUTAS_ADMIN)('%s %s → 401', async (metodo, ruta) => {
    const http = ctx.http() as unknown as Record<
      string,
      (r: string) => import('supertest').Test
    >;
    const r = await http[metodo](ruta).send({ id_sesion: 'X' });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({
      detail: 'Se requiere iniciar sesión en el panel',
    });
  });

  it.each(RUTAS_ADMIN)(
    '%s %s con token inválido → 401',
    async (metodo, ruta) => {
      const http = ctx.http() as unknown as Record<
        string,
        (r: string) => import('supertest').Test
      >;
      await http[metodo](ruta)
        .set('Authorization', 'Bearer no.es.un.jwt')
        .set('Cookie', 'ferremax_admin=falso')
        .expect(401);
    },
  );
});

describe('autenticación', () => {
  it('POST /api/admin/login rechaza credenciales malas', async () => {
    const r = await ctx
      .http()
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'mala' })
      .expect(401);
    expect(r.body).toEqual({ detail: 'Usuario o contraseña incorrectos' });
    await ctx
      .http()
      .post('/api/admin/login')
      .send({ username: 'nadie', password: 'x' })
      .expect(401);
    await ctx
      .http()
      .post('/api/admin/login')
      .send({ username: 'admin' })
      .expect(422);
  });

  it('POST /api/admin/login emite cookie httpOnly, Secure y SameSite=Lax (sin localStorage)', async () => {
    const r = await ctx.http().post('/api/admin/login').send(ADMIN).expect(200);
    const setCookie = ([] as string[])
      .concat(r.headers['set-cookie'] ?? [])
      .join(';');
    expect(setCookie).toMatch(/ferremax_admin=/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(typeof r.body.token).toBe('string'); // compatibilidad v1
  });

  it('GET /api/admin/verificar acepta la cookie o Authorization: Bearer', async () => {
    expect(
      (
        await ctx
          .http()
          .get('/api/admin/verificar')
          .set('Cookie', cookie)
          .expect(200)
      ).body,
    ).toEqual({ valido: true, username: 'admin' });
    const token = cookie.split('=')[1];
    await ctx
      .http()
      .get('/api/admin/verificar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('POST /api/admin/logout borra la cookie', async () => {
    const r = await ctx
      .http()
      .post('/api/admin/logout')
      .set('Cookie', cookie)
      .expect(200);
    expect(
      ([] as string[]).concat(r.headers['set-cookie'] ?? []).join(';'),
    ).toMatch(/ferremax_admin=;.*Expires=Thu, 01 Jan 1970/);
  });
});

describe('configuración', () => {
  it('GET /api/admin/config público solo expone lo que necesita la tienda', async () => {
    const r = await ctx.http().get('/api/admin/config').expect(200);
    expect(r.body).toEqual({ k: 5, fuente_datos: 'sintetico' });
  });

  it('GET /api/admin/config con sesión de admin devuelve la configuración completa', async () => {
    const r = await ctx
      .http()
      .get('/api/admin/config')
      .set('Cookie', cookie)
      .expect(200);
    expect(r.body).toMatchObject({
      id: 1,
      modo_activo: 'ML',
      k: 5,
      soporte_min: 0.01,
      confianza_min: 0.15,
      lift_min: 1.2,
      peso_contenido: 1,
      variante_ml: 'COMPLETO',
    });
  });

  it('PUT /api/admin/config valida, guarda y pide al recommender recargar', async () => {
    await ctx
      .http()
      .put('/api/admin/config')
      .set('Cookie', cookie)
      .send({
        modo_activo: 'ML',
        k: 0,
        soporte_min: 0.01,
        confianza_min: 0.1,
        lift_min: 1,
        peso_contenido: 1,
      })
      .expect(422);
    const r = await ctx
      .http()
      .put('/api/admin/config')
      .set('Cookie', cookie)
      .send({
        modo_activo: 'CONV',
        k: 6,
        soporte_min: 0.02,
        confianza_min: 0.2,
        lift_min: 1.5,
        peso_contenido: 1.25,
        variante_ml: 'REGLAS',
      })
      .expect(200);
    expect(r.body).toMatchObject({
      modo_activo: 'CONV',
      k: 6,
      peso_contenido: 1.25,
      variante_ml: 'REGLAS',
    });
    expect(ctx.recommender.llamadas.some((l) => l.metodo === 'recargar')).toBe(
      true,
    );
    await ctx
      .http()
      .put('/api/admin/config')
      .set('Cookie', cookie)
      .send({
        modo_activo: 'ML',
        k: 5,
        soporte_min: 0.01,
        confianza_min: 0.15,
        lift_min: 1.2,
        peso_contenido: 1,
        variante_ml: 'COMPLETO',
      })
      .expect(200);
  });
});

describe('modelo', () => {
  it('GET /api/admin/reglas: formato v1, orden confianza × lift y filtro por umbrales', async () => {
    await ctx.prisma.reglaAsociacion.createMany({
      data: [
        {
          antecedente: ['TUB-001'],
          consecuente: ['ACC-001'],
          soporte: 0.03,
          confianza: 0.6,
          lift: 9,
          version_modelo: 'v-test',
        },
        {
          antecedente: ['PIN-001', 'FER-003'],
          consecuente: ['PIN-007'],
          soporte: 0.02,
          confianza: 0.9,
          lift: 8,
          version_modelo: 'v-test',
        },
        {
          antecedente: ['HER-001'],
          consecuente: ['CLO-001'],
          soporte: 0.005,
          confianza: 0.3,
          lift: 2,
          version_modelo: 'v-test',
        },
        {
          antecedente: ['X'],
          consecuente: ['Y'],
          soporte: 0.5,
          confianza: 0.9,
          lift: 9,
          vigente: false,
          version_modelo: 'vieja',
        },
      ],
    });
    const todas = (
      await ctx
        .http()
        .get('/api/admin/reglas')
        .set('Cookie', cookie)
        .expect(200)
    ).body;
    expect(todas).toHaveLength(3);
    expect(todas[0]).toMatchObject({
      antecedentes: '["PIN-001","FER-003"]',
      consecuentes: '["PIN-007"]',
      confianza: 0.9,
      lift: 8,
      version_modelo: 'v-test',
    });
    expect(Object.keys(todas[0]).sort()).toEqual([
      'antecedentes',
      'confianza',
      'consecuentes',
      'id',
      'lift',
      'soporte',
      'version_modelo',
    ]);
    const vigentes = (
      await ctx
        .http()
        .get('/api/admin/reglas')
        .query({ vigentes: 'true' })
        .set('Cookie', cookie)
        .expect(200)
    ).body;
    expect(vigentes).toHaveLength(2); // la de soporte 0.005 no cumple soporte_min = 0.01
  });

  it('POST /api/admin/modelo/reentrenar delega en el recommender', async () => {
    const r = await ctx
      .http()
      .post('/api/admin/modelo/reentrenar')
      .set('Cookie', cookie)
      .expect(200);
    expect(r.body).toEqual({
      status: 'ok',
      message: 'Modelo falso entrenado',
      comprobantes: 5000,
    });
  });

  it('GET/POST /api/admin/evaluacion-offline: null si nunca se corrió; POST delega; GET devuelve la última', async () => {
    expect(
      (
        await ctx
          .http()
          .get('/api/admin/evaluacion-offline')
          .set('Cookie', cookie)
          .expect(200)
      ).text,
    ).toBe('null');
    const r = await ctx
      .http()
      .post('/api/admin/evaluacion-offline')
      .set('Cookie', cookie)
      .expect(200);
    expect(r.body.modos).toEqual(['CONV', 'ML_COMPLETO']);
    await ctx.prisma.evaluacionOffline.create({
      data: { resultado: { modos: ['CONV'], fecha_corrida: 'hoy' } },
    });
    expect(
      (
        await ctx
          .http()
          .get('/api/admin/evaluacion-offline')
          .set('Cookie', cookie)
          .expect(200)
      ).body,
    ).toEqual({ modos: ['CONV'], fecha_corrida: 'hoy' });
  });
});

describe('sesión experimental completa', () => {
  let token: string;
  let id: string;

  it('POST /api/admin/sesiones inicia la sesión, emite el token del dispositivo y fija el modo', async () => {
    const r = await ctx
      .http()
      .post('/api/admin/sesiones')
      .set('Cookie', cookie)
      .send({
        codigo_cliente: 'CLI-0007',
        escenario: 'Pintar una habitación',
        condicion: 'CONV',
        orden: 1,
      })
      .expect(200);
    ({ token_dispositivo: token } = r.body);
    id = r.body.sesion.id_sesion;
    expect(id).toBe('SES-0001');
    expect(r.body.sesion).toMatchObject({
      codigo_cliente: 'CLI-0007',
      escenario: 'Pintar una habitación',
      condicion: 'CONV',
      orden: '1',
      fin: null,
      valida: true,
    });
    expect(r.body.sesion).not.toHaveProperty('token_dispositivo');
    expect(
      (await ctx.prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } }))
        .modo_activo,
    ).toBe('CONV');
    await ctx
      .http()
      .post('/api/admin/sesiones')
      .set('Cookie', cookie)
      .send({
        codigo_cliente: 'CLI-0008',
        escenario: 'x',
        condicion: 'ML',
        orden: 'B',
      })
      .expect(409);
  });

  it('GET /api/sesiones/activa solo la entrega al navegador con el token', async () => {
    const r = await ctx
      .http()
      .get('/api/sesiones/activa')
      .set('x-sesion-evaluacion', token)
      .expect(200);
    expect(r.body).toMatchObject({
      id_sesion: id,
      codigo_cliente: 'CLI-0007',
      condicion: 'CONV',
    });
    expect(
      (
        await ctx
          .http()
          .get('/api/sesiones/activa')
          .set('x-sesion-evaluacion', 'otro')
          .expect(200)
      ).text,
    ).toBe('null');
  });

  it('la condición la decide la sesión, aunque el modo activo cambie', async () => {
    await ctx.prisma.configuracion.update({
      where: { id: 1 },
      data: { modo_activo: 'ML' },
    });
    await ctx
      .http()
      .get('/api/recomendar')
      .query({ sku: 'PIN-001' })
      .set('x-sesion-evaluacion', token)
      .expect(200);
    expect(ctx.recommender.ultima('recomendar')).toMatchObject({
      modo: 'CONV',
    });
    await ctx
      .http()
      .get('/api/recomendar')
      .query({ sku: 'PIN-001' })
      .expect(200);
    expect(ctx.recommender.ultima('recomendar')).toMatchObject({ modo: 'ML' });
  });

  it('el historial del cliente solo se usa con el token de SU sesión', async () => {
    const propio = await ctx
      .http()
      .get('/api/recomendar/cliente/CLI-0007')
      .query({ skus: 'PIN-001' })
      .set('x-sesion-evaluacion', token)
      .expect(200);
    expect(propio.body.base).toBe('HISTORIAL_Y_CARRITO');
    expect(ctx.recommender.ultima('recomendar')).toMatchObject({
      codigo_cliente: 'CLI-0007',
      modo: 'CONV',
    });
    const ajeno = await ctx
      .http()
      .get('/api/recomendar/cliente/CLI-0001')
      .query({ skus: 'PIN-001' })
      .set('x-sesion-evaluacion', token)
      .expect(200);
    expect(ajeno.body.base).toBe('SIN_HISTORIAL');
    expect(ctx.recommender.ultima('recomendar')).toMatchObject({
      codigo_cliente: null,
    });
  });

  it('eventos y pedido quedan asociados a la sesión con su condición', async () => {
    const t0 = Date.now() - 60_000;
    const enviar = (
      tipo_evento: string,
      timestamp: number,
      extra: Record<string, unknown> = {},
    ) =>
      ctx
        .http()
        .post('/api/eventos')
        .set('x-sesion-evaluacion', token)
        .send({
          id_sesion: 'MENTIRA',
          codigo_cliente: 'OTRO',
          condicion: 'ML',
          tipo_evento,
          timestamp,
          ...extra,
        })
        .expect(200);
    await enviar('INICIO_BUSQUEDA', t0);
    await enviar('CONSULTA', t0 + 1000, { texto_consulta: 'pintar' });
    for (const [i, sku] of [
      'PIN-007',
      'PIN-008',
      'FER-003',
      'PIN-002',
      'PIN-005',
    ].entries()) {
      await enviar('RECOM_MOSTRADA', t0 + 5000, {
        sku,
        posicion_recom: i + 1,
        origen: 'RECOMENDACION',
      });
    }
    await enviar('PRODUCTO_AGREGADO', t0 + 9000, {
      sku: 'PIN-007',
      posicion_recom: 1,
      origen: 'RECOMENDACION',
    });
    const pedido = await ctx
      .http()
      .post('/api/carrito/confirmar')
      .set('x-sesion-evaluacion', token)
      .send({
        id_sesion: 'MENTIRA',
        codigo_cliente: 'OTRO',
        condicion: 'ML',
        timestamp: 1,
        total: 1,
        items: [
          { sku: 'PIN-001', cantidad: 1, precio: 1, origen: 'BUSQUEDA' },
          { sku: 'PIN-007', cantidad: 1, precio: 1, origen: 'RECOMENDACION' },
        ],
      })
      .expect(200);
    expect(pedido.body.total).toBe(82);

    const eventos = (
      await ctx
        .http()
        .get('/api/admin/eventos')
        .query({ id_sesion: id })
        .set('Cookie', cookie)
        .expect(200)
    ).body;
    expect(eventos).toHaveLength(9);
    expect(
      eventos.every(
        (e: { codigo_cliente: string; condicion: string }) =>
          e.codigo_cliente === 'CLI-0007' && e.condicion === 'CONV',
      ),
    ).toBe(true);
    expect(eventos[0].tipo_evento).toBe('CONFIRMACION_CARRITO'); // más recientes primero
    expect(Object.keys(eventos[0]).sort()).toEqual([
      'codigo_cliente',
      'condicion',
      'escenario',
      'id_evento',
      'id_sesion',
      'origen',
      'posicion_recom',
      'sku',
      'texto_consulta',
      'timestamp',
      'tipo_evento',
    ]);
    const filtrados = (
      await ctx
        .http()
        .get('/api/admin/eventos')
        .query({ tipo_evento: 'RECOM_MOSTRADA', condicion: 'CONV', limite: 2 })
        .set('Cookie', cookie)
        .expect(200)
    ).body;
    expect(filtrados).toHaveLength(2);
    expect(
      (
        await ctx.prisma.sesionEvaluacion.findUniqueOrThrow({
          where: { id_sesion: id },
        })
      ).completa,
    ).toBe(true);
  });

  it('PUT /api/admin/sesiones la finaliza como válida y GET la lista sin el token', async () => {
    const r = await ctx
      .http()
      .put('/api/admin/sesiones')
      .set('Cookie', cookie)
      .send({ id_sesion: id, valida: true })
      .expect(200);
    expect(r.body).toMatchObject({
      id_sesion: id,
      valida: true,
      completa: true,
    });
    expect(r.body.fin).not.toBeNull();
    await ctx
      .http()
      .put('/api/admin/sesiones')
      .set('Cookie', cookie)
      .send({ id_sesion: 'NOPE' })
      .expect(404);
    const lista = (
      await ctx
        .http()
        .get('/api/admin/sesiones')
        .set('Cookie', cookie)
        .expect(200)
    ).body;
    expect(lista).toHaveLength(1);
    expect(lista[0]).not.toHaveProperty('token_dispositivo');
    // Tras finalizar, el token ya no da acceso a la sesión
    expect(
      (
        await ctx
          .http()
          .get('/api/sesiones/activa')
          .set('x-sesion-evaluacion', token)
          .expect(200)
      ).text,
    ).toBe('null');
  });

  it('GET /api/admin/indicadores calcula Precision@5, tiempo de selección y McNemar por condición', async () => {
    const r = (
      await ctx
        .http()
        .get('/api/admin/indicadores')
        .set('Cookie', cookie)
        .expect(200)
    ).body;
    expect(r.agregados.CONV).toMatchObject({
      sesiones_validas_completas: 1,
      sesiones_registradas: 1,
      precision_5: { n: 1, media: 0.2 },
      recs_aceptadas: { n: 1, media: 1 },
    });
    expect(r.agregados.CONV.tiempo_seleccion_s.media).toBeGreaterThan(59);
    expect(r.agregados.ML.sesiones_validas_completas).toBe(0);
    expect(r.por_sesion.CONV[0]).toMatchObject({
      id_sesion: id,
      listas_mostradas: 1,
      recs_mostradas: 5,
      recs_aceptadas: 1,
      precision_5: 0.2,
      acierto: true,
    });
    expect(r.mcnemar_exacto.CONV_vs_ML).toMatchObject({
      n_pares: 0,
      p_valor: 1,
    });
  });

  it('GET /api/admin/dashboard lista pedidos, clientes y productos con poco stock', async () => {
    const r = (
      await ctx
        .http()
        .get('/api/admin/dashboard')
        .set('Cookie', cookie)
        .expect(200)
    ).body;
    expect(r.pedidos[0]).toMatchObject({
      codigo_cliente: 'CLI-0007',
      estado: 'Registrado',
      total: 82,
      condicion: 'CONV',
    });
    const participante = r.clientes.find(
      (c: { codigo: string }) => c.codigo === 'CLI-0007',
    );
    expect(participante).toMatchObject({
      participa_evaluacion: true,
      tipo: 'Histórico',
    });
    expect(r.clientes.length).toBeGreaterThan(800);
    expect(r.productos_bajo_stock.map((p: { sku: string }) => p.sku)).toContain(
      'CON-001',
    );
  });
});
