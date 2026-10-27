import { readFileSync } from 'node:fs';
import { CAMPOS_PRODUCTO, crearApp, reiniciarBD } from './ayudante.js';

let ctx: Awaited<ReturnType<typeof crearApp>>;

beforeAll(async () => {
  ctx = await crearApp();
  await reiniciarBD(ctx.prisma);
});
afterAll(() => ctx.app.close());

const evento = (extra: Record<string, unknown> = {}) => ({
  id_sesion: 'SES-INVENTADA',
  codigo_cliente: 'CLI-0042',
  escenario: null,
  condicion: 'CONV',
  tipo_evento: 'CONSULTA',
  texto_consulta: 'pintar pared',
  timestamp: 1_761_500_000_000,
  ...extra,
});

describe('catálogo', () => {
  it('GET / responde la identificación del servicio', async () => {
    const r = await ctx.http().get('/').expect(200);
    expect(r.body).toMatchObject({ servicio: 'FerreMax API' });
  });

  it('GET /api/health informa base de datos y recommender', async () => {
    const r = await ctx.http().get('/api/health').expect(200);
    expect(r.body).toMatchObject({
      status: 'ok',
      base_datos: 'ok',
      recommender: 'ok',
    });
  });

  it('GET /api/productos devuelve los 52 productos con la forma de v1, del más al menos vendido', async () => {
    const r = await ctx.http().get('/api/productos').expect(200);
    expect(r.body).toHaveLength(52);
    for (const p of r.body)
      expect(Object.keys(p).sort()).toEqual([...CAMPOS_PRODUCTO].sort());
    expect(r.body[0].sku).toBe('VAL-002'); // el más vendido del historial sintético
    expect(typeof r.body[0].precio).toBe('number');
  });

  it('GET /api/productos?categoria filtra por categoría', async () => {
    const r = await ctx
      .http()
      .get('/api/productos')
      .query({ categoria: 'Gasfitería' })
      .expect(200);
    expect(r.body.length).toBeGreaterThan(0);
    expect(
      r.body.every((p: { categoria: string }) => p.categoria === 'Gasfitería'),
    ).toBe(true);
  });

  it('GET /api/productos/:sku devuelve el producto o 404 "Producto no encontrado"', async () => {
    const r = await ctx.http().get('/api/productos/VAL-002').expect(200);
    expect(r.body).toEqual({
      sku: 'VAL-002',
      nombre: 'Cinta teflón 3/4" x 10m',
      marca: 'Fast',
      categoria: 'Gasfitería',
      subcategoria: 'Accesorios PVC',
      unidad: 'Und',
      uso: 'Sellado de roscas en gasfitería',
      precio: 2.5,
      stock: 118,
    });
    const no = await ctx.http().get('/api/productos/NO-EXISTE').expect(404);
    expect(no.body).toEqual({ detail: 'Producto no encontrado' });
  });

  it('GET /api/categorias es idéntico al de v1', async () => {
    const v1 = JSON.parse(readFileSync('../data/seed/categorias.json', 'utf8'));
    const r = await ctx.http().get('/api/categorias').expect(200);
    expect(r.body).toEqual(v1);
  });

  it('rutas inexistentes responden 404 con detail, como FastAPI', async () => {
    const r = await ctx.http().get('/api/no-existe').expect(404);
    expect(r.body).toEqual({ detail: 'Not Found' });
  });
});

describe('recomendaciones', () => {
  it('POST /api/buscar-necesidad delega en el recommender (k = 12 por defecto)', async () => {
    const r = await ctx
      .http()
      .post('/api/buscar-necesidad')
      .send({ texto: 'quiero pintar mi sala' })
      .expect(200);
    expect(r.body[0]).toMatchObject({
      sku: 'PIN-001',
      terminos: ['pintura'],
      posicion: 1,
    });
    expect(ctx.recommender.ultima('buscarNecesidad')).toEqual({
      texto: 'quiero pintar mi sala',
      k: 12,
    });
    await ctx
      .http()
      .post('/api/buscar-necesidad')
      .send({ texto: '' })
      .expect(422);
  });

  it('GET /api/recomendar usa el modo activo y k de la configuración', async () => {
    const r = await ctx
      .http()
      .get('/api/recomendar')
      .query({ sku: 'PIN-001' })
      .expect(200);
    expect(r.body).toHaveLength(5);
    expect(ctx.recommender.ultima('recomendar')).toMatchObject({
      skus: ['PIN-001'],
      k: 5,
      modo: 'ML',
    });
    await ctx
      .http()
      .get('/api/recomendar')
      .query({ sku: 'NO-EXISTE' })
      .expect(404);
    const sinSku = await ctx.http().get('/api/recomendar').expect(422);
    expect(sinSku.body.detail[0].loc).toEqual(['query', 'sku']);
  });

  it('POST /api/recomendar/carrito envía el carrito y k', async () => {
    const r = await ctx
      .http()
      .post('/api/recomendar/carrito')
      .send({ skus: ['TUB-001', 'ACC-001'], k: 3 })
      .expect(200);
    expect(r.body.map((p: { sku: string }) => p.sku)).not.toContain('ACC-001');
    expect(ctx.recommender.ultima('recomendar')).toMatchObject({
      skus: ['TUB-001', 'ACC-001'],
      k: 3,
    });
    await ctx
      .http()
      .post('/api/recomendar/carrito')
      .send({ skus: 'TUB-001' })
      .expect(422);
  });

  it('GET /api/recomendar/cliente/:codigo no usa el historial sin el token de su sesión', async () => {
    const r = await ctx
      .http()
      .get('/api/recomendar/cliente/CLI-0001')
      .query({ skus: ['HER-005', 'PIN-001'], k: 3 })
      .expect(200);
    expect(r.body.base).toBe('SIN_HISTORIAL');
    expect(r.body.resultados).toHaveLength(3);
    expect(ctx.recommender.ultima('recomendar')).toMatchObject({
      skus: ['HER-005', 'PIN-001'],
      codigo_cliente: null,
    });
    // Un solo ?skus= también se acepta como lista
    await ctx
      .http()
      .get('/api/recomendar/cliente/CLI-0001')
      .query({ skus: 'HER-005' })
      .expect(200);
    expect(ctx.recommender.ultima('recomendar')).toMatchObject({
      skus: ['HER-005'],
    });
  });
});

describe('experimento sin sesión', () => {
  it('GET /api/sesiones/activa responde el literal null', async () => {
    const r = await ctx.http().get('/api/sesiones/activa').expect(200);
    expect(r.text).toBe('null');
  });

  it('POST /api/eventos registra sin sesión y con la condición del modo activo (ignora la del cliente)', async () => {
    const r = await ctx
      .http()
      .post('/api/eventos')
      .send(evento({ texto_consulta: 'tubería en mal estado' }))
      .expect(200);
    const e = await ctx.prisma.evento.findUniqueOrThrow({
      where: { id: BigInt(r.body.id_evento) },
    });
    expect(e).toMatchObject({
      id_sesion: 'SIN-SESION',
      codigo_cliente: 'CLI-0042',
      condicion: 'ML',
      tipo_evento: 'CONSULTA',
      texto_consulta: 'tubería en mal estado',
    });
    expect(e.timestamp).toBe(1_761_500_000_000n);
  });

  it('POST /api/eventos valida el cuerpo (422 con el formato de v1)', async () => {
    const r = await ctx
      .http()
      .post('/api/eventos')
      .send(evento({ condicion: 'OTRA', extra: 1 }))
      .expect(422);
    expect(r.body.detail).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ loc: ['body', 'condicion'] }),
        expect.objectContaining({
          loc: ['body', 'extra'],
          type: 'extra_forbidden',
        }),
      ]),
    );
  });

  it('POST /api/carrito/confirmar recalcula el total, descuenta stock y registra el cierre con la hora del servidor', async () => {
    const antes = Date.now();
    const r = await ctx
      .http()
      .post('/api/carrito/confirmar')
      .send({
        id_sesion: 'X',
        codigo_cliente: 'CLI-0042',
        condicion: 'CONV',
        timestamp: 1,
        total: 0.02,
        entrega: 'Delivery en Lima',
        pago: 'Yape',
        items: [
          { sku: 'VAL-002', cantidad: 2, precio: 0.01, origen: 'BUSQUEDA' },
          {
            sku: 'ACC-001',
            cantidad: 1,
            precio: 0.01,
            origen: 'RECOMENDACION',
          },
          { sku: 'VAL-002', cantidad: 1, precio: 0.01, origen: 'BUSQUEDA' },
        ],
      })
      .expect(200);
    expect(r.body).toMatchObject({
      total: 9,
      estado: 'Registrado',
      entrega: 'Delivery en Lima',
      pago: 'Yape',
    }); // 3 × 2.50 + 1.50
    expect(
      (
        await ctx.prisma.producto.findUniqueOrThrow({
          where: { sku: 'VAL-002' },
        })
      ).stock,
    ).toBe(115);
    const pedido = await ctx.prisma.pedido.findUniqueOrThrow({
      where: { id: r.body.id_pedido },
      include: { items: true },
    });
    expect(pedido).toMatchObject({ id_sesion: 'SIN-SESION', condicion: 'ML' });
    expect(
      pedido.items
        .map((i) => [i.sku, i.cantidad, Number(i.precio)])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ['ACC-001', 1, 1.5],
      ['VAL-002', 3, 2.5],
    ]);
    const cierre = await ctx.prisma.evento.findFirstOrThrow({
      where: { tipo_evento: 'CONFIRMACION_CARRITO' },
      orderBy: { id: 'desc' },
    });
    expect(Number(cierre.timestamp)).toBeGreaterThanOrEqual(antes);
  });

  it('POST /api/carrito/confirmar es atómico: si un producto no tiene stock no descuenta nada', async () => {
    const r = await ctx
      .http()
      .post('/api/carrito/confirmar')
      .send({
        id_sesion: 'X',
        codigo_cliente: 'C',
        condicion: 'ML',
        timestamp: 1,
        total: 1,
        items: [
          { sku: 'ELE-007', cantidad: 1, precio: 1, origen: 'BUSQUEDA' },
          { sku: 'CON-001', cantidad: 1, precio: 1, origen: 'BUSQUEDA' },
        ],
      })
      .expect(409);
    expect(r.body.detail).toMatch(/^Stock insuficiente para Cemento Sol/);
    expect(
      (
        await ctx.prisma.producto.findUniqueOrThrow({
          where: { sku: 'ELE-007' },
        })
      ).stock,
    ).toBe(55);
    await ctx
      .http()
      .post('/api/carrito/confirmar')
      .send({
        id_sesion: 'X',
        codigo_cliente: 'C',
        condicion: 'ML',
        timestamp: 1,
        total: 0,
        items: [],
      })
      .expect(400);
    await ctx
      .http()
      .post('/api/carrito/confirmar')
      .send({
        id_sesion: 'X',
        codigo_cliente: 'C',
        condicion: 'ML',
        timestamp: 1,
        total: 0,
        items: [{ sku: 'NOPE', cantidad: 1, precio: 1, origen: 'X' }],
      })
      .expect(404);
  });
});
