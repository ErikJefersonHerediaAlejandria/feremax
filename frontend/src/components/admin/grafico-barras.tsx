"use client";

import { useId } from "react";

export interface Serie {
  nombre: string;
  /** Color de relleno (validado para daltonismo y contraste ≥ 3:1 sobre blanco). */
  color: string;
  /** Rayado diagonal: segunda codificación, para no depender solo del color. */
  rayado?: boolean;
}

export interface Grupo {
  etiqueta: string;
  valores: (number | null | undefined)[];
}

const relleno = (s: Serie) =>
  s.rayado ? `repeating-linear-gradient(135deg, ${s.color} 0 6px, color-mix(in srgb, ${s.color} 55%, white) 6px 9px)` : s.color;

/**
 * Barras horizontales agrupadas en HTML/CSS (sin librería): un grupo por categoría y una barra por serie,
 * con eje de valores, rejilla, etiqueta de valor en cada barra y leyenda. Se adapta a cualquier ancho (≥ 360 px).
 */
export function GraficoBarras({ titulo, descripcion, series, grupos, decimales = 3 }: { titulo: string; descripcion: string; series: Serie[]; grupos: Grupo[]; decimales?: number }) {
  const id = useId();
  const maximo = Math.max(0, ...grupos.flatMap((g) => g.valores.map((v) => v ?? 0)));
  const tope = Math.max(0.25, Math.ceil(maximo * 4 + 1e-9) / 4); // dominio "redondo" en pasos de 0,25
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * tope);
  const fmt = (v: number) => v.toFixed(decimales);

  return (
    <figure className="min-w-0">
      <figcaption id={`${id}-t`} className="text-sm font-semibold text-marca-900">
        {titulo}
      </figcaption>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700" aria-hidden="true">
        {series.map((s) => (
          <li key={s.nombre} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm" style={{ background: relleno(s) }} />
            {s.nombre}
          </li>
        ))}
      </ul>
      <div role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className="mt-3">
        <div className="grid grid-cols-[minmax(5.5rem,8rem)_1fr] gap-x-2 sm:gap-x-3">
          {grupos.map((g) => (
            <div key={g.etiqueta} className="contents">
              <div className="flex items-center border-b border-slate-100 py-2 text-xs font-semibold leading-tight text-slate-800 [overflow-wrap:anywhere]">{g.etiqueta}</div>
              <div className="relative border-b border-l border-slate-100 border-l-slate-400 py-2 pr-12">
                <Rejilla marcas={marcas} tope={tope} />
                <div className="relative space-y-[2px]">
                  {series.map((s, i) => {
                    const v = g.valores[i];
                    const ancho = v === null || v === undefined ? 0 : (v / tope) * 100;
                    return (
                      <div key={s.nombre} className="flex h-4 items-center" title={`${g.etiqueta} · ${s.nombre}: ${v === null || v === undefined ? "sin dato" : fmt(v)}`}>
                        <div className="h-full rounded-r-[4px]" style={{ width: `${ancho}%`, background: relleno(s), minWidth: v ? 2 : 0 }} />
                        <span className="ml-1 whitespace-nowrap text-[11px] font-medium tabular-nums text-slate-800">{v === null || v === undefined ? "—" : fmt(v)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          <div aria-hidden="true" />
          <div className="relative mr-12 h-5 text-[11px] tabular-nums text-slate-600" aria-hidden="true">
            {marcas.map((m, i) => (
              <span key={m} className="absolute top-1 -translate-x-1/2" style={{ left: `${(m / tope) * 100}%`, transform: i === 0 ? "none" : undefined }}>
                {m.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p id={`${id}-d`} className="sr-only">
        {descripcion}{" "}
        {grupos.map((g) => `${g.etiqueta}: ${series.map((s, i) => `${s.nombre} ${g.valores[i] == null ? "sin dato" : fmt(g.valores[i] as number)}`).join(", ")}.`).join(" ")}
      </p>
    </figure>
  );
}

function Rejilla({ marcas, tope }: { marcas: number[]; tope: number }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 right-12" aria-hidden="true">
      {marcas.slice(1).map((m) => (
        <span key={m} className="absolute inset-y-0 border-l border-dashed border-slate-200" style={{ left: `${(m / tope) * 100}%` }} />
      ))}
    </div>
  );
}
