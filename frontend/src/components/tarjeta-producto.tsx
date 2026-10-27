"use client";

import Link from "next/link";
import { useTienda } from "@/contexto/tienda";
import { precio, urlDetalle } from "@/lib/formato";
import type { Origen, Producto, ProductoPuntuado } from "@/lib/tipos";
import { Icono } from "./icono";
import { ImagenProducto } from "./imagen-producto";

export function EstadoStock({ stock }: { stock: number }) {
  return stock > 0 ? (
    <span className="chip bg-emerald-50 text-emerald-800">
      <Icono nombre="check_circle" className="text-sm" /> En stock
    </span>
  ) : (
    <span className="chip bg-red-50 text-red-800">
      <Icono nombre="block" className="text-sm" /> Sin stock
    </span>
  );
}

export function BotonAgregar({ producto, origen, posicion = null, compacto = false }: { producto: Producto; origen: Origen; posicion?: number | null; compacto?: boolean }) {
  const { agregar, avisar } = useTienda();
  const sinStock = producto.stock <= 0;
  return (
    <button
      type="button"
      className={`btn-primario ${compacto ? "px-3 py-2" : "w-full"}`}
      disabled={sinStock}
      onClick={() => {
        agregar(producto, origen, posicion);
        avisar(`${producto.nombre} agregado al carrito`);
      }}
      aria-label={sinStock ? `${producto.nombre} sin stock` : `Agregar ${producto.nombre} al carrito`}
    >
      <Icono nombre={sinStock ? "block" : "add_shopping_cart"} />
      {sinStock ? "Sin stock" : "Agregar"}
    </button>
  );
}

/**
 * Tarjeta de producto. `origen` es de dónde viene el producto para el experimento (CATEGORIA, BUSQUEDA o
 * RECOMENDACION); si es una recomendación, el clic se registra como CLIC_RECOMENDACION y el detalle hereda la posición.
 */
export function TarjetaProducto({
  producto,
  origen,
  children,
  prioridad = false,
}: {
  producto: Producto | ProductoPuntuado;
  origen: Origen;
  children?: React.ReactNode;
  prioridad?: boolean;
}) {
  const { registrar } = useTienda();
  const posicion = "posicion" in producto && origen === "RECOMENDACION" ? producto.posicion : null;
  const href = urlDetalle(producto.sku, origen, posicion);
  const alClic = () => {
    if (origen === "RECOMENDACION") registrar({ tipo_evento: "CLIC_RECOMENDACION", sku: producto.sku, origen, posicion_recom: posicion });
  };
  return (
    <article className="tarjeta flex h-full flex-col p-3 transition-shadow hover:shadow-md">
      <Link href={href} onClick={alClic} className="block" tabIndex={-1} aria-hidden="true">
        <ImagenProducto sku={producto.sku} nombre={producto.nombre} categoria={producto.categoria} prioridad={prioridad} />
      </Link>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{producto.marca}</span>
          <EstadoStock stock={producto.stock} />
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold text-marca-900">
          <Link href={href} onClick={alClic} className="hover:underline">
            {producto.nombre}
          </Link>
        </h3>
        {children}
        <div className="mt-auto pt-2">
          <p className="text-xs text-slate-600">Precio unitario</p>
          <p className="text-lg font-extrabold text-marca-900">{precio(producto.precio)}</p>
        </div>
        <BotonAgregar producto={producto} origen={origen} posicion={posicion} />
      </div>
    </article>
  );
}
