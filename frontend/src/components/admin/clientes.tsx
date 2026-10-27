"use client";

import { useMemo, useState } from "react";
import { plural } from "@/lib/formato";
import { useDatos } from "./contexto";
import type { Dashboard } from "./tipos";
import { Alerta, CabeceraPagina, Cargando, siNo, Tabla, Td, Th, Vacio } from "./ui";

const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeZone: "America/Lima" }).format(new Date(iso)) : "—";

export function VistaClientes() {
  const { datos, error, cargando } = useDatos<Dashboard>("/api/admin/dashboard");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [participa, setParticipa] = useState("");
  const clientes = datos?.clientes;
  const tipos = useMemo(() => [...new Set((clientes ?? []).map((c) => c.tipo).filter((t): t is string => !!t))].sort(), [clientes]);
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (clientes ?? []).filter(
      (c) =>
        (!t || c.codigo.toLowerCase().includes(t)) &&
        (!tipo || c.tipo === tipo) &&
        (!participa || String(c.participa_evaluacion) === participa),
    );
  }, [clientes, q, tipo, participa]);

  return (
    <div className="space-y-4">
      <CabeceraPagina titulo="Clientes" subtitulo="Clientes anonimizados por código (sin datos personales)" />
      {error && <Alerta tipo="error">No se pudieron cargar los clientes: {error}</Alerta>}
      <div className="tarjeta grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label htmlFor="cli-q" className="mb-1 block text-sm font-medium">
            Buscar código
          </label>
          <input id="cli-q" type="search" className="campo" placeholder="CLI-…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cli-tipo" className="mb-1 block text-sm font-medium">
            Tipo
          </label>
          <select id="cli-tipo" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cli-part" className="mb-1 block text-sm font-medium">
            Participa en evaluación
          </label>
          <select id="cli-part" className="campo" value={participa} onChange={(e) => setParticipa(e.target.value)}>
            <option value="">Todos</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
      <p className="text-sm text-slate-600" role="status">
        {cargando ? "Cargando…" : clientes ? `${plural(filtrados.length, "cliente")} de ${clientes.length}` : ""}
      </p>
      {cargando && !datos ? (
        <Cargando />
      ) : clientes && filtrados.length === 0 ? (
        <Vacio>{clientes.length === 0 ? "Sin datos: aún no hay clientes." : "Ningún cliente coincide con los filtros."}</Vacio>
      ) : clientes ? (
        <Tabla titulo="Clientes">
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Tipo</Th>
              <Th>Primera compra</Th>
              <Th derecha>Comprobantes</Th>
              <Th>Participa en evaluación</Th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.codigo}>
                <Td mono>{c.codigo}</Td>
                <Td>{c.tipo || "—"}</Td>
                <Td>{fecha(c.primera_compra)}</Td>
                <Td derecha>{c.n_boletas ?? "—"}</Td>
                <Td>{siNo(c.participa_evaluacion)}</Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      ) : null}
    </div>
  );
}
