"use client";

import { useState, type FormEvent } from "react";
import { Icono } from "@/components/icono";
import { fechaHora } from "@/lib/formato";
import { useDatos } from "./contexto";
import type { Evento } from "./tipos";
import { Alerta, CabeceraPagina, Cargando, ChipCondicion, descargarCsv, Tabla, Td, Th, Vacio } from "./ui";

const TIPOS = ["INICIO_BUSQUEDA", "CONSULTA", "RECOM_MOSTRADA", "PRODUCTO_AGREGADO", "PRODUCTO_RETIRADO", "CONFIRMACION_CARRITO"];
const COLUMNAS = ["id_evento", "id_sesion", "codigo_cliente", "escenario", "condicion", "tipo_evento", "texto_consulta", "sku", "posicion_recom", "origen", "timestamp"] as const;

type Filtros = { id_sesion: string; codigo_cliente: string; condicion: string; tipo_evento: string; limite: string };
const VACIOS: Filtros = { id_sesion: "", codigo_cliente: "", condicion: "", tipo_evento: "", limite: "5000" };

function construirRuta(f: Filtros) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v.trim()) p.set(k, v.trim());
  const q = p.toString();
  return `/api/admin/eventos${q ? `?${q}` : ""}`;
}

const iso = (ts: number | null) => (ts === null ? "" : new Date(ts).toISOString());

export function VistaEventos() {
  const [form, setForm] = useState<Filtros>(VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(VACIOS);
  const [aviso, setAviso] = useState<string | null>(null);
  const { datos, error, cargando, recargar } = useDatos<Evento[]>(construirRuta(aplicados));
  const limiteValido = /^\d+$/.test(form.limite) && Number(form.limite) >= 1 && Number(form.limite) <= 50000;

  const campo = (k: keyof Filtros) => ({
    id: `ev-${k}`,
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: k === "codigo_cliente" ? e.target.value.toUpperCase() : e.target.value })),
  });

  function aplicar(e: FormEvent) {
    e.preventDefault();
    if (!limiteValido) return;
    setAviso(null);
    setAplicados(form);
    recargar();
  }

  function limpiar() {
    setForm(VACIOS);
    setAplicados(VACIOS);
    setAviso(null);
    recargar();
  }

  function exportar() {
    if (!datos?.length) return;
    descargarCsv(
      "registro_eventos.csv",
      [...COLUMNAS, "timestamp_iso"],
      datos.map((ev) => [...COLUMNAS.map((c) => ev[c]), iso(ev.timestamp)]),
    );
    setAviso(`CSV exportado con ${datos.length} eventos.`);
  }

  return (
    <div className="space-y-4">
      <CabeceraPagina titulo="Registro de eventos" subtitulo="Trazabilidad de eventos por sesión y condición experimental" />
      <form onSubmit={aplicar} className="tarjeta grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Filtros de eventos">
        <div>
          <label htmlFor="ev-id_sesion" className="mb-1 block text-sm font-medium">
            Sesión (id_sesion)
          </label>
          <input className="campo" placeholder="SES-…" {...campo("id_sesion")} />
        </div>
        <div>
          <label htmlFor="ev-codigo_cliente" className="mb-1 block text-sm font-medium">
            Cliente (codigo_cliente)
          </label>
          <input className="campo" placeholder="CLI-…" autoCapitalize="characters" {...campo("codigo_cliente")} />
        </div>
        <div>
          <label htmlFor="ev-condicion" className="mb-1 block text-sm font-medium">
            Condición
          </label>
          <select className="campo" {...campo("condicion")}>
            <option value="">Todas</option>
            <option value="CONV">CONV</option>
            <option value="ML">ML</option>
          </select>
        </div>
        <div>
          <label htmlFor="ev-tipo_evento" className="mb-1 block text-sm font-medium">
            Tipo de evento
          </label>
          <select className="campo" {...campo("tipo_evento")}>
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ev-limite" className="mb-1 block text-sm font-medium">
            Límite de filas
          </label>
          <input
            className={`campo ${limiteValido ? "" : "border-red-600"}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={50000}
            aria-invalid={!limiteValido}
            aria-describedby="ev-limite-ayuda"
            {...campo("limite")}
          />
          <p id="ev-limite-ayuda" className={`mt-1 text-xs ${limiteValido ? "text-slate-600" : "text-red-800"}`}>
            Entre 1 y 50 000
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="btn-marca" disabled={!limiteValido}>
            <Icono nombre="filter_alt" /> Filtrar
          </button>
          <button type="button" className="btn-secundario" onClick={limpiar}>
            Limpiar
          </button>
          <button type="button" className="btn-primario sm:ml-auto" onClick={exportar} disabled={!datos?.length || cargando}>
            <Icono nombre="download" /> Exportar CSV
          </button>
        </div>
      </form>

      {aviso && (
        <Alerta tipo="ok" alCerrar={() => setAviso(null)}>
          {aviso}
        </Alerta>
      )}
      {error && <Alerta tipo="error">No se pudieron cargar los eventos: {error}</Alerta>}
      <p className="text-sm text-slate-600" role="status">
        {cargando ? "Cargando…" : datos ? `${datos.length} eventos encontrados (más recientes primero).` : ""}
      </p>

      {cargando && !datos ? (
        <Cargando />
      ) : datos && datos.length === 0 ? (
        <Vacio>Sin datos para los filtros seleccionados.</Vacio>
      ) : datos ? (
        <Tabla titulo="Eventos registrados" className={cargando ? "opacity-60" : ""}>
          <thead>
            <tr>
              {COLUMNAS.map((c) => (
                <Th key={c} className="normal-case">
                  {c}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.map((ev) => (
              <tr key={ev.id_evento}>
                <Td mono>{ev.id_evento}</Td>
                <Td mono>{ev.id_sesion}</Td>
                <Td mono>{ev.codigo_cliente}</Td>
                <Td>{ev.escenario ?? "—"}</Td>
                <Td>
                  <ChipCondicion valor={ev.condicion} />
                </Td>
                <Td mono>{ev.tipo_evento}</Td>
                <Td className="max-w-64 whitespace-normal">{ev.texto_consulta ?? "—"}</Td>
                <Td mono>{ev.sku ?? "—"}</Td>
                <Td derecha>{ev.posicion_recom ?? "—"}</Td>
                <Td>{ev.origen ?? "—"}</Td>
                <Td className="whitespace-nowrap">
                  {ev.timestamp === null ? (
                    "—"
                  ) : (
                    <time dateTime={iso(ev.timestamp)} title={iso(ev.timestamp)}>
                      {fechaHora(new Date(ev.timestamp))}
                      <span className="block font-mono text-xs text-slate-600">{ev.timestamp}</span>
                    </time>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      ) : null}
    </div>
  );
}
