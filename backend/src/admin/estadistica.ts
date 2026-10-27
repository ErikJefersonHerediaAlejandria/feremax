/** Estadísticos descriptivos (desviación estándar muestral) y test de McNemar exacto. */

export interface Resumen {
  n: number;
  media: number | null;
  mediana: number | null;
  de: number | null;
  min: number | null;
  max: number | null;
}

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;

export function resumen(valores: number[]): Resumen {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0)
    return { n: 0, media: null, mediana: null, de: null, min: null, max: null };
  const media = v.reduce((s, x) => s + x, 0) / n;
  const mediana = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const de =
    n > 1
      ? Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1))
      : 0;
  return {
    n,
    media: r4(media),
    mediana: r4(mediana),
    de: r4(de),
    min: r4(v[0]),
    max: r4(v[n - 1]),
  };
}

export interface McNemar {
  n_pares: number;
  ambos: number;
  solo_primero: number;
  solo_segundo: number;
  ninguno: number;
  p_valor: number;
}

/** p-valor bilateral exacto: 2 · P(X ≤ min(b, c)) con X ~ Binomial(b + c, 0.5), acotado a 1. */
export function pBinomialBilateral(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const m = Math.min(b, c);
  let pmf = 0.5 ** n;
  let cola = pmf;
  for (let i = 0; i < m; i++) {
    pmf = (pmf * (n - i)) / (i + 1);
    cola += pmf;
  }
  return Math.min(1, 2 * cola);
}

export function mcnemarExacto(pares: [boolean, boolean][]): McNemar {
  let ambos = 0,
    solo1 = 0,
    solo2 = 0,
    ninguno = 0;
  for (const [a, b] of pares) {
    if (a && b) ambos++;
    else if (a) solo1++;
    else if (b) solo2++;
    else ninguno++;
  }
  const p = pBinomialBilateral(solo1, solo2);
  return {
    n_pares: pares.length,
    ambos,
    solo_primero: solo1,
    solo_segundo: solo2,
    ninguno,
    p_valor: Number(p.toPrecision(4)),
  };
}
