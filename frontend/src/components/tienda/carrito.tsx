"use client";

import Link from "next/link";
import { useTienda } from "@/contexto/tienda";
import { precio, urlDetalle } from "@/lib/formato";
import { Icono } from "../icono";
import { ImagenProducto } from "../imagen-producto";
import { Recomendaciones } from "./recomendaciones";

export function CarritoVacio({ titulo = "Tu carrito está vacío", texto = "Busca lo que necesitas para tu proyecto y agrégalo aquí." }) {
  return (
    <div className="tarjeta mx-auto max-w-lg p-10 text-center">
      <Icono nombre="remove_shopping_cart" className="text-5xl text-slate-500" />
      <h2 className="mt-2 text-xl font-bold text-marca-900">{titulo}</h2>
      <p className="text-slate-700">{texto}</p>
      <Link href="/" className="btn-primario mt-5">
        <Icono nombre="storefront" /> Ir a la tienda
      </Link>
    </div>
  );
}

export function Carrito() {
  const { listo, carrito, unidades, subtotal, cambiarCantidad, quitar, vaciar } = useTienda();
  if (!listo) return <p className="py-10 text-center text-slate-700" role="status">Cargando carrito…</p>;

  return (
    <>
      <h1 className="text-3xl font-extrabold text-marca-900">
        Tu carrito <span className="text-lg font-semibold text-slate-600">({unidades === 1 ? "1 producto" : `${unidades} productos`})</span>
      </h1>
      <p className="mb-6 text-sm text-slate-700">Tu carrito se conserva en este navegador.</p>
      {carrito.length === 0 ? (
        <CarritoVacio />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <section aria-label="Productos del carrito">
            <ul className="tarjeta divide-y divide-slate-200">
              {carrito.map((i) => (
                <li key={i.sku} className="flex flex-wrap gap-4 p-4 sm:flex-nowrap">
                  <Link href={urlDetalle(i.sku)} className="w-20 shrink-0" tabIndex={-1} aria-hidden="true">
                    <ImagenProducto sku={i.sku} nombre={i.nombre} categoria={i.categoria} sizes="80px" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-slate-600">{i.marca}</p>
                    <Link href={urlDetalle(i.sku)} className="font-semibold text-marca-900 hover:underline">
                      {i.nombre}
                    </Link>
                    <p className="text-xs text-slate-600">
                      SKU: {i.sku} · {precio(i.precio)} c/u
                    </p>
                    <button type="button" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-red-800 hover:underline" onClick={() => quitar(i.sku)}>
                      <Icono nombre="delete" /> Quitar
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center rounded-lg border border-slate-300 bg-white" role="group" aria-label={`Cantidad de ${i.nombre}`}>
                      <button type="button" className="px-2.5 py-2" aria-label="Disminuir cantidad" onClick={() => cambiarCantidad(i.sku, i.cantidad - 1)}>
                        <Icono nombre="remove" />
                      </button>
                      <output className="w-8 text-center font-bold">{i.cantidad}</output>
                      <button
                        type="button"
                        className="px-2.5 py-2"
                        aria-label="Aumentar cantidad"
                        disabled={i.stock > 0 && i.cantidad >= i.stock}
                        onClick={() => cambiarCantidad(i.sku, i.cantidad + 1)}
                      >
                        <Icono nombre="add" />
                      </button>
                    </div>
                    <p className="w-24 text-right font-extrabold text-marca-900">{precio(i.precio * i.cantidad)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm font-semibold">
              <Link href="/busqueda" className="inline-flex items-center gap-1 text-marca-800 hover:underline">
                <Icono nombre="arrow_back" /> Continuar explorando el catálogo
              </Link>
              <button type="button" className="inline-flex items-center gap-1 text-red-800 hover:underline" onClick={vaciar}>
                <Icono nombre="remove_shopping_cart" /> Vaciar el carrito
              </button>
            </div>
          </section>

          <aside className="tarjeta h-fit p-5 lg:sticky lg:top-4" aria-labelledby="resumen">
            <h2 id="resumen" className="text-lg font-bold text-marca-900">
              Resumen de compra
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal ({unidades === 1 ? "1 producto" : `${unidades} productos`})</dt>
                <dd>{precio(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt title="El envío no se incluye en el total; se coordina según la modalidad de entrega">Envío</dt>
                <dd>Por coordinar</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-extrabold text-marca-900">
                <dt>Total</dt>
                <dd>{precio(subtotal)}</dd>
              </div>
            </dl>
            <p className="text-right text-xs text-slate-600">Precios con IGV</p>
            <Link href="/confirmar" className="btn-primario mt-4 w-full py-3">
              <Icono nombre="lock" /> Continuar con el pedido
            </Link>
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-600">
              <Icono nombre="schedule" /> Al confirmar se registra la hora de cierre de tu selección.
            </p>
          </aside>
        </div>
      )}

      {carrito.length > 0 && (
        <div className="mt-10">
          <Recomendaciones
            contexto="carrito"
            skus={carrito.map((i) => i.sku)}
            titulo="Complementa tu compra"
            subtitulo="Complementos sugeridos para los productos de tu carrito. Marca los que quieras y agrégalos juntos."
            vacio="No hay recomendaciones para tu carrito."
            seleccionMultiple
          />
        </div>
      )}
    </>
  );
}
