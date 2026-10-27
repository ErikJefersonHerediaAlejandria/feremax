"use client";

import { useMemo, useState } from "react";
import { Icono } from "@/components/icono";
import { precio } from "@/lib/formato";
import type { Producto } from "@/lib/tipos";
import { useDatos } from "./contexto";
import type { Dashboard } from "./tipos";
import { Alerta, CabeceraPagina, Cargando, Tabla, Td, Th, Vacio } from "./ui";

export const STOCK_MINIMO = 5;

export function VistaInventario() {
  const productos = useDatos<Producto[]>("/api/productos");
  const tablero = useDatos<Dashboard>("/api/admin/dashboard");
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("");
  const [soloBajo, setSoloBajo] = useState(false);

  const bajo = useMemo(() => {
    const s = new Set(tablero.datos?.productos_bajo_stock.map((p) => p.sku) ?? []);
    for (const p of productos.datos ?? []) if (p.stock <= STOCK_MINIMO) s.add(p.sku);
    return s;
  }, [tablero.datos, productos.datos]);
  const categorias = useMemo(() => [...new Set((productos.datos ?? []).map((p) => p.categoria).filter((c): c is string => !!c))].sort(), [productos.datos]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (productos.datos ?? []).filter(
      (p) =>
        (!t || [p.sku, p.nombre, p.categoria, p.marca].some((v) => v?.toLowerCase().includes(t))) &&
        (!categoria || p.categoria === categoria) &&
        (!soloBajo || bajo.has(p.sku)),
    );
  }, [productos.datos, q, categoria, soloBajo, bajo]);

  const total = productos.datos?.length ?? 0;

  return (
    <div className="space-y-4">
      <CabeceraPagina titulo="Productos e inventario" subtitulo="Catálogo y stock actual" />
      {productos.error && <Alerta tipo="error">No se pudieron cargar los productos: {productos.error}</Alerta>}
      {tablero.error && <Alerta tipo="info">No se pudo leer el stock bajo del panel ({tablero.error}); se resaltan los productos con stock ≤ {STOCK_MINIMO}.</Alerta>}

      <div className="tarjeta grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label htmlFor="inv-q" className="mb-1 block text-sm font-medium">
            Buscar
          </label>
          <input id="inv-q" type="search" className="campo" placeholder="SKU, nombre, categoría o marca…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="inv-cat" className="mb-1 block text-sm font-medium">
            Categoría
          </label>
          <select id="inv-cat" className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 py-2.5 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-acento-700" checked={soloBajo} onChange={(e) => setSoloBajo(e.target.checked)} />
          Solo stock bajo (≤ {STOCK_MINIMO}) ({bajo.size})
        </label>
      </div>

      <p className="text-sm text-slate-600" role="status">
        {productos.cargando ? "Cargando…" : `${filtrados.length} de ${total} productos`}
      </p>

      {productos.cargando && !productos.datos ? (
        <Cargando />
      ) : productos.datos && filtrados.length === 0 ? (
        <Vacio>{total === 0 ? "Sin datos: el catálogo está vacío." : "Ningún producto coincide con los filtros."}</Vacio>
      ) : productos.datos ? (
        <Tabla titulo="Productos del catálogo">
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Nombre</Th>
              <Th>Categoría</Th>
              <Th>Marca</Th>
              <Th derecha>Precio</Th>
              <Th derecha>Stock</Th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => {
              const esBajo = bajo.has(p.sku);
              return (
                <tr key={p.sku} className={esBajo ? "bg-red-50" : undefined}>
                  <Td mono>{p.sku}</Td>
                  <Td className="min-w-56 whitespace-normal">{p.nombre}</Td>
                  <Td>{p.categoria ?? "—"}</Td>
                  <Td>{p.marca ?? "—"}</Td>
                  <Td derecha>{precio(p.precio)}</Td>
                  <Td derecha className={esBajo ? "font-bold text-red-800" : ""}>
                    {esBajo && <Icono nombre="warning" className="mr-1 text-base" />}
                    {p.stock}
                    {esBajo && <span className="sr-only"> (stock bajo)</span>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      ) : null}
    </div>
  );
}
