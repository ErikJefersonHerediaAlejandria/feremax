"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTienda } from "@/contexto/tienda";
import type { Origen, Producto } from "@/lib/tipos";
import { Icono } from "../icono";
import { Recomendaciones } from "./recomendaciones";

const ORIGENES: Origen[] = ["BUSQUEDA", "CATEGORIA", "RECOMENDACION"];

/** Cantidad, "Agregar al carrito" y "Comprar ahora". Registra VER_DETALLE con el origen de la visita. */
export function FichaCompra({ producto }: { producto: Producto }) {
  const sp = useSearchParams();
  const router = useRouter();
  const { agregar, avisar, registrar } = useTienda();
  const [cantidad, setCantidad] = useState(1);
  const origenUrl = (sp.get("origen") ?? "").toUpperCase() as Origen;
  const origen: Origen = ORIGENES.includes(origenUrl) ? origenUrl : "BUSQUEDA";
  const pos = origen === "RECOMENDACION" ? Number(sp.get("pos")) || null : null;
  const sinStock = producto.stock <= 0;
  const visto = useRef("");

  useEffect(() => {
    if (visto.current === producto.sku) return;
    visto.current = producto.sku;
    registrar({ tipo_evento: "VER_DETALLE", sku: producto.sku, origen, posicion_recom: pos });
  }, [producto.sku, origen, pos, registrar]);

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3">
      <div>
        <span id="cantidad-etiqueta" className="mb-1 block text-sm font-semibold text-marca-900">
          Cantidad
        </span>
        <div className="flex items-center rounded-lg border border-slate-300 bg-white" role="group" aria-labelledby="cantidad-etiqueta">
          <button type="button" className="px-3 py-2.5" aria-label="Disminuir cantidad" disabled={cantidad <= 1} onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
            <Icono nombre="remove" />
          </button>
          <output className="w-10 text-center font-bold" aria-live="polite">
            {cantidad}
          </output>
          <button
            type="button"
            className="px-3 py-2.5"
            aria-label="Aumentar cantidad"
            disabled={sinStock || cantidad >= producto.stock}
            onClick={() => setCantidad((c) => Math.min(producto.stock, c + 1))}
          >
            <Icono nombre="add" />
          </button>
        </div>
      </div>
      <button
        type="button"
        className="btn-marca flex-1 py-3"
        disabled={sinStock}
        onClick={() => {
          agregar(producto, origen, pos, cantidad);
          avisar(`${cantidad} × ${producto.nombre} agregado al carrito`);
        }}
      >
        <Icono nombre="shopping_cart" /> Agregar al carrito
      </button>
      <button
        type="button"
        className="btn-primario flex-1 py-3"
        disabled={sinStock}
        onClick={() => {
          agregar(producto, origen, pos, cantidad);
          router.push("/carrito");
        }}
      >
        Comprar ahora
      </button>
    </div>
  );
}

export function PestanasProducto({ producto: p }: { producto: Producto }) {
  const pestanas = [
    { id: "uso", titulo: "Uso recomendado", contenido: p.uso ?? "Sin información de uso registrada para este producto." },
    { id: "descripcion", titulo: "Descripción", contenido: `${p.nombre}, de la marca ${p.marca ?? "—"}. Producto de la línea ${p.subcategoria ?? p.categoria} de ${p.categoria}.` },
    { id: "ficha", titulo: "Ficha técnica", contenido: null },
  ];
  const [activa, setActiva] = useState("uso");
  return (
    <section className="tarjeta mt-8 p-5" aria-label="Información del producto">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {pestanas.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={activa === t.id}
            aria-controls={`panel-${t.id}`}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${activa === t.id ? "border-acento-700 text-acento-800" : "border-transparent text-slate-700"}`}
            onClick={() => setActiva(t.id)}
          >
            {t.titulo}
          </button>
        ))}
      </div>
      {pestanas.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={activa !== t.id} className="pt-4 text-sm text-slate-800">
          {t.contenido ?? (
            <dl className="grid gap-3 sm:grid-cols-4">
              {[
                ["category", "Categoría", p.categoria],
                ["label", "Subcategoría", p.subcategoria],
                ["straighten", "Unidad de venta", p.unidad],
                ["qr_code_2", "SKU", p.sku],
              ].map(([i, k, v]) => (
                <div key={k} className="rounded-lg bg-superficie p-3">
                  <dt className="flex items-center gap-1 text-xs text-slate-600">
                    <Icono nombre={i!} /> {k}
                  </dt>
                  <dd className="font-semibold text-marca-900">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </section>
  );
}

export function RecomendacionesDetalle({ sku }: { sku: string }) {
  return (
    <Recomendaciones
      contexto="detalle"
      skus={[sku]}
      titulo="Complementa tu compra"
      subtitulo="Productos que suelen llevarse junto con este. Marca los que quieras y agrégalos al carrito."
      vacio="No hay recomendaciones para este producto."
      seleccionMultiple
    />
  );
}
