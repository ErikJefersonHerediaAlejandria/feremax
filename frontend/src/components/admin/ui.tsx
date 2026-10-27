"use client";

import type { ReactNode } from "react";
import { Icono } from "@/components/icono";

export type TipoAlerta = "ok" | "error" | "info";

const ESTILO_ALERTA: Record<TipoAlerta, { clase: string; icono: string }> = {
  ok: { clase: "border-emerald-200 bg-emerald-50 text-emerald-900", icono: "check_circle" },
  error: { clase: "border-red-200 bg-red-50 text-red-900", icono: "error" },
  info: { clase: "border-sky-200 bg-sky-50 text-sky-900", icono: "info" },
};

/** Mensaje de estado. Los errores usan role="alert"; el resto, role="status" (ambos aria-live). */
export function Alerta({ tipo, children, alCerrar }: { tipo: TipoAlerta; children: ReactNode; alCerrar?: () => void }) {
  const e = ESTILO_ALERTA[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} aria-live={tipo === "error" ? "assertive" : "polite"} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${e.clase}`}>
      <Icono nombre={e.icono} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {alCerrar && (
        <button type="button" onClick={alCerrar} className="-m-1 rounded p-1 hover:bg-black/5" aria-label="Cerrar mensaje">
          <Icono nombre="close" />
        </button>
      )}
    </div>
  );
}

/** Región aria-live siempre montada, para que los lectores de pantalla anuncien mensajes que aparecen después. */
export function ZonaMensajes({ children }: { children: ReactNode }) {
  return <div className="space-y-2 empty:hidden">{children}</div>;
}

export function CabeceraPagina({ titulo, subtitulo, acciones }: { titulo: string; subtitulo: string; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-marca-900 sm:text-2xl">{titulo}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitulo}</p>
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

export function Seccion({ titulo, subtitulo, icono, acciones, children, id }: { titulo: string; subtitulo?: ReactNode; icono?: string; acciones?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="tarjeta p-4 sm:p-5" aria-labelledby={id}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={id} className="flex items-center gap-2 text-base font-bold text-marca-900">
            {icono && <Icono nombre={icono} className="text-acento-700" />}
            {titulo}
          </h2>
          {subtitulo && <p className="mt-0.5 text-sm text-slate-600">{subtitulo}</p>}
        </div>
        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
      {children}
    </section>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-sm text-slate-600">
      <Icono nombre="progress_activity" className="animate-spin" />
      {texto}
    </p>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
      <Icono nombre="inbox" />
      {children}
    </p>
  );
}

/** Tabla con desplazamiento horizontal propio (la página no se desplaza en horizontal). */
export function Tabla({ titulo, children, className = "" }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-x-auto rounded-lg border border-slate-200 ${className}`} tabIndex={0} role="region" aria-label={titulo}>
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <caption className="sr-only">{titulo}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, derecha, className = "" }: { children: ReactNode; derecha?: boolean; className?: string }) {
  return (
    <th scope="col" className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 ${derecha ? "text-right" : ""} ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, derecha, mono, className = "" }: { children: ReactNode; derecha?: boolean; mono?: boolean; className?: string }) {
  return <td className={`border-b border-slate-100 px-3 py-2 align-top ${derecha ? "text-right tabular-nums" : ""} ${mono ? "font-mono text-xs" : ""} ${className}`}>{children}</td>;
}

export function ChipCondicion({ valor }: { valor: string | null | undefined }) {
  if (!valor) return <span className="text-slate-500">—</span>;
  const clase = valor === "ML_COMPLETO" ? "bg-emerald-100 text-emerald-900" : valor.startsWith("ML") ? "bg-acento-100 text-acento-800" : "bg-slate-200 text-slate-800";
  return <span className={`chip ${clase}`}>{valor}</span>;
}

export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900">{children ?? "—"}</dd>
    </div>
  );
}

// --- formato numérico ---
export const num = (x: number | null | undefined, decimales = 2) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : x.toFixed(decimales));
export const entero = (x: number | null | undefined) => (x === null || x === undefined ? "—" : x.toLocaleString("es-PE"));
export const pct = (x: number | null | undefined, decimales = 1) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(decimales)} %`);
export const pValor = (p: number | null | undefined) => (p === null || p === undefined ? "—" : p < 0.0001 ? "< 0.0001" : p.toFixed(4));
export const siNo = (b: boolean | null | undefined) => (b === null || b === undefined ? "—" : b ? "Sí" : "No");
export const parSkus = (texto: string): string[] => {
  try {
    const v = JSON.parse(texto) as unknown;
    return Array.isArray(v) ? v.map(String) : [String(v)];
  } catch {
    return [texto];
  }
};

/** Descarga un CSV (UTF-8 con BOM, separador coma, CRLF) generado en el navegador. */
export function descargarCsv(nombre: string, columnas: string[], filas: unknown[][]) {
  const celda = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = [columnas, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");
  const blob = new Blob(["﻿", texto], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
