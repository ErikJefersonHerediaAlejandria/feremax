import { mcnemarExacto, pBinomialBilateral, resumen } from './estadistica.js';
import { metricasSesion } from './indicadores.service.js';
import type { Evento, SesionEvaluacion } from '../generated/prisma/client.js';

describe('resumen', () => {
  it('media, mediana, desviación muestral, mínimo y máximo', () => {
    expect(resumen([0.2, 0.4, 0.6, 0.8])).toEqual({
      n: 4,
      media: 0.5,
      mediana: 0.5,
      de: 0.2582,
      min: 0.2,
      max: 0.8,
    });
    expect(resumen([3])).toEqual({
      n: 1,
      media: 3,
      mediana: 3,
      de: 0,
      min: 3,
      max: 3,
    });
    expect(resumen([])).toEqual({
      n: 0,
      media: null,
      mediana: null,
      de: null,
      min: null,
      max: null,
    });
  });
});

describe('McNemar exacto', () => {
  it('coincide con el cálculo binomial (y con scipy en el recommender)', () => {
    expect(pBinomialBilateral(1, 9)).toBeCloseTo(22 / 1024, 10);
    expect(pBinomialBilateral(0, 0)).toBe(1);
    expect(pBinomialBilateral(5, 5)).toBe(1);
    expect(pBinomialBilateral(12, 64)).toBeCloseTo(1.002e-9, 11);
  });

  it('cuenta la tabla 2×2 de pares', () => {
    const pares: [boolean, boolean][] = [
      [true, true],
      [true, false],
      [false, true],
      [false, true],
      [false, false],
    ];
    expect(mcnemarExacto(pares)).toEqual({
      n_pares: 5,
      ambos: 1,
      solo_primero: 1,
      solo_segundo: 2,
      ninguno: 1,
      p_valor: 1,
    });
  });
});

describe('métricas por sesión', () => {
  const sesion = {
    id_sesion: 'S',
    codigo_cliente: 'C',
    escenario: 'e',
    condicion: 'ML',
    orden: 'A',
    inicio: new Date(),
    fin: new Date(),
    valida: true,
    completa: true,
    token_dispositivo: 't',
  } as SesionEvaluacion;
  const ev = (
    tipo_evento: string,
    timestamp: number,
    sku: string | null = null,
    posicion_recom: number | null = null,
  ) =>
    ({
      id: 1n,
      id_sesion: 'S',
      codigo_cliente: 'C',
      escenario: null,
      condicion: 'ML',
      tipo_evento,
      texto_consulta: null,
      sku,
      posicion_recom,
      origen: null,
      timestamp: BigInt(timestamp),
      recibido_en: new Date(),
    }) as Evento;

  it('Precision@5 media por lista, tiempo de selección y aciertos', () => {
    const eventos = [
      ev('INICIO_BUSQUEDA', 1_000),
      ...['A', 'B', 'C', 'D', 'E', 'F'].map((s, i) =>
        ev('RECOM_MOSTRADA', 2_000, s, i + 1),
      ), // F está en posición 6: fuera del top 5
      ...['A', 'G', 'H', 'I', 'J'].map((s, i) =>
        ev('RECOM_MOSTRADA', 5_000, s, i + 1),
      ),
      ev('CONFIRMACION_CARRITO', 31_000),
    ];
    const m = metricasSesion(sesion, eventos, new Set(['A', 'B', 'F', 'Z']));
    expect(m.tiempo_s).toBe(30);
    expect(m.listas_mostradas).toBe(2);
    expect(m.recs_mostradas).toBe(9);
    expect(m.recs_aceptadas).toBe(2); // A y B (F no se mostró en el top 5; Z no se mostró)
    expect(m.precision_5).toBeCloseTo((2 / 5 + 1 / 5) / 2);
    expect(m.acierto).toBe(true);
  });

  it('sin listas ni cierre', () => {
    const m = metricasSesion(sesion, [ev('CONSULTA', 1)], new Set());
    expect(m).toMatchObject({
      tiempo_s: null,
      precision_5: null,
      listas_mostradas: 0,
      acierto: false,
    });
  });
});
