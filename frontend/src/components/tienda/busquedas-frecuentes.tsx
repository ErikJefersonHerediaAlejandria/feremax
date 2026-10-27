"use client";

import Link from "next/link";
import { useTienda } from "@/contexto/tienda";
import { urlBusqueda } from "@/lib/formato";
import { Icono } from "../icono";

export const FRECUENTES = [
  { icono: "format_paint", texto: "Pintar una pared" },
  { icono: "water_drop", texto: "Instalar punto de agua" },
  { icono: "bolt", texto: "Cambiar un tomacorriente" },
  { icono: "foundation", texto: "Vaciar una losa pequeña" },
  { icono: "plumbing", texto: "Reparar una fuga de agua" },
  { icono: "hardware", texto: "Colgar repisas" },
];

export function BusquedasFrecuentes() {
  const { registrar } = useTienda();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-slate-700">Búsquedas frecuentes:</span>
      {FRECUENTES.map((f) => (
        <Link
          key={f.texto}
          href={urlBusqueda({ q: f.texto })}
          onClick={() => registrar({ tipo_evento: "CONSULTA", texto_consulta: f.texto, origen: "BUSQUEDA" })}
          className="chip border border-slate-300 bg-white py-1.5 text-marca-900 hover:border-acento-600 hover:text-acento-800"
        >
          <Icono nombre={f.icono} className="text-acento-700" /> {f.texto}
        </Link>
      ))}
    </div>
  );
}
