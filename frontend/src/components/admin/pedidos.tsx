"use client";

import { useMemo, useState } from "react";
import { fechaHora, numeroPedido, plural, precio } from "@/lib/formato";
import { useDatos } from "./contexto";
import type { Dashboard } from "./tipos";
import { Alerta, CabeceraPagina, Cargando, ChipCondicion, Tabla, Td, Th, Vacio } from "./ui";

export function VistaPedidos() {
  const { datos, error, cargando } = useDatos<Dashboard>("/api/admin/dashboard");
  const [q, setQ] = useState("");
  const [condicion, setCondicion] = useState("");
  const pedidos = datos?.pedidos;
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (pedidos ?? []).filter(
      (p) =>
        (!t || [String(p.id), numeroPedido(p.id), p.codigo_cliente, p.id_sesion, p.estado].some((v) => v?.toLowerCase().includes(t))) &&
        (!condicion || (condicion === "SIN" ? !p.condicion : p.condicion === condicion)),
    );
  }, [pedidos, q, condicion]);
  const total = filtrados.reduce((s, p) => s + (p.total ?? 0), 0);

  return (
    <div className="space-y-4">
      <CabeceraPagina titulo="Pedidos" subtitulo="Pedidos registrados al confirmar el carrito" />
      {error && <Alerta tipo="error">No se pudieron cargar los pedidos: {error}</Alerta>}
      <div className="tarjeta grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="ped-q" className="mb-1 block text-sm font-medium">
            Buscar
          </label>
          <input id="ped-q" type="search" className="campo" placeholder="N.º de pedido, cliente, sesión o estado…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ped-cond" className="mb-1 block text-sm font-medium">
            Condición
          </label>
          <select id="ped-cond" className="campo" value={condicion} onChange={(e) => setCondicion(e.target.value)}>
            <option value="">Todas</option>
            <option value="CONV">CONV</option>
            <option value="ML">ML</option>
            <option value="SIN">Sin condición</option>
          </select>
        </div>
      </div>
      <p className="text-sm text-slate-600" role="status">
        {cargando ? "Cargando…" : pedidos ? `${plural(filtrados.length, "pedido")} · total ${precio(total)}` : ""}
      </p>
      {cargando && !datos ? (
        <Cargando />
      ) : pedidos && filtrados.length === 0 ? (
        <Vacio>{pedidos.length === 0 ? "Sin datos: aún no hay pedidos." : "Ningún pedido coincide con los filtros."}</Vacio>
      ) : pedidos ? (
        <Tabla titulo="Pedidos registrados">
          <thead>
            <tr>
              <Th>N.º</Th>
              <Th>Fecha</Th>
              <Th>Cliente</Th>
              <Th>Sesión</Th>
              <Th>Condición</Th>
              <Th>Entrega</Th>
              <Th>Pago</Th>
              <Th>Estado</Th>
              <Th derecha>Total</Th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <Td mono>{numeroPedido(p.id)}</Td>
                <Td className="whitespace-nowrap">{fechaHora(p.fecha)}</Td>
                <Td mono>{p.codigo_cliente}</Td>
                <Td mono>{p.id_sesion ?? "—"}</Td>
                <Td>
                  <ChipCondicion valor={p.condicion} />
                </Td>
                <Td>{p.entrega || "—"}</Td>
                <Td>{p.pago || "—"}</Td>
                <Td>{p.estado}</Td>
                <Td derecha>{precio(p.total)}</Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      ) : null}
    </div>
  );
}
