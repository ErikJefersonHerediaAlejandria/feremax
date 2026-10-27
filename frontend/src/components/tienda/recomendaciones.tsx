"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTienda } from "@/contexto/tienda";
import { recomendaciones } from "@/lib/api-cliente";
import { precio } from "@/lib/formato";
import type { ProductoPuntuado } from "@/lib/tipos";
import { Icono } from "../icono";
import { TarjetaProducto } from "../tarjeta-producto";

type Contexto = "inicio" | "busqueda" | "detalle" | "carrito" | "cuenta";

/**
 * Lista de recomendaciones de un contexto de la tienda. Cada vez que se muestra una lista nueva registra un
 * RECOM_MOSTRADA por producto, todos con el mismo timestamp (así los indicadores reconocen la lista).
 */
export function Recomendaciones({
  contexto,
  skus,
  titulo,
  subtitulo,
  seleccionMultiple = false,
  vacio = "No hay recomendaciones disponibles por ahora.",
  k = 5,
}: {
  contexto: Contexto;
  skus: string[];
  titulo: string;
  subtitulo?: string;
  seleccionMultiple?: boolean;
  vacio?: string;
  k?: number;
}) {
  const { listo, codigoCliente, registrar, agregar, avisar, sesion } = useTienda();
  const [lista, setLista] = useState<ProductoPuntuado[] | null>(null);
  const [error, setError] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const ultimaMostrada = useRef<string>("");
  // La lista se pide (y se registra como mostrada) cuando la sección se acerca a la pantalla: así RECOM_MOSTRADA
  // refleja lo que el participante pudo ver, y la carga inicial de la página no compite con el recomendador.
  const seccion = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = seccion.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver((entradas) => entradas.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);
  const clave = useMemo(() => [...skus].sort().join(","), [skus]);

  useEffect(() => {
    if (!listo || !visible) return;
    const control = new AbortController();
    const lista = clave ? clave.split(",") : [];
    const peticion =
      contexto === "cuenta" && codigoCliente
        ? recomendaciones.porCliente(codigoCliente, lista, k, control.signal)
        : lista.length === 1
          ? recomendaciones.porProducto(lista[0], k, control.signal)
          : recomendaciones.porCarrito(lista, k, control.signal);
    peticion
      .then((r) => {
        setError(false);
        setLista(r);
        setSeleccion(new Set());
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") {
          setError(true);
          setLista([]);
        }
      });
    return () => control.abort();
    // sesion: al vincular o terminar una sesión cambia la condición del recomendador
  }, [listo, visible, clave, contexto, codigoCliente, k, sesion?.id_sesion]);

  useEffect(() => {
    if (!lista?.length) return;
    const firma = `${contexto}|${clave}|${lista.map((p) => p.sku).join(",")}`;
    if (ultimaMostrada.current === firma) return;
    ultimaMostrada.current = firma;
    const timestamp = Date.now();
    for (const p of lista) registrar({ tipo_evento: "RECOM_MOSTRADA", sku: p.sku, posicion_recom: p.posicion, origen: "RECOMENDACION", timestamp });
  }, [lista, contexto, clave, registrar]);

  const elegidos = lista?.filter((p) => seleccion.has(p.sku)) ?? [];

  return (
    <section ref={seccion} aria-labelledby={`recos-${contexto}`} className="rounded-2xl bg-acento-50 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`recos-${contexto}`} className="flex items-center gap-2 text-xl font-extrabold text-marca-900">
            <Icono nombre="auto_awesome" className="text-acento-700" /> {titulo}
          </h2>
          {subtitulo && <p className="text-sm text-slate-700">{subtitulo}</p>}
        </div>
      </div>
      {lista === null ? (
        // Esqueleto del mismo tamaño que las tarjetas: reserva el espacio y evita desplazar la página al cargar (CLS).
        <div aria-busy="true">
          <p className="sr-only" role="status">
            Cargando recomendaciones…
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: k }, (_, i) => (
            <li key={i} className="tarjeta flex flex-col p-3" aria-hidden="true">
              <div className="aspect-square animate-pulse rounded-lg bg-slate-100" />
              <div className="mt-3 h-3 w-1/3 rounded bg-slate-100" />
              <div className="mt-2 h-10 rounded bg-slate-100" />
              <div className="mt-6 h-3 w-1/4 rounded bg-slate-100" />
              <div className="mt-1 h-6 w-1/2 rounded bg-slate-100" />
              <div className="mt-2 h-10 rounded-lg bg-slate-100" />
            </li>
          ))}
          </ul>
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-800" role="alert">
          No se pudieron cargar las recomendaciones.
        </p>
      ) : lista.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-700">{vacio}</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {lista.map((p) => (
              <li key={p.sku} className="relative">
                {seleccionMultiple && (
                  <label className="absolute left-2 top-2 z-10 flex items-center rounded bg-white/90 p-1.5 shadow">
                    <input
                      type="checkbox"
                      className="size-4 accent-acento-700"
                      checked={seleccion.has(p.sku)}
                      disabled={p.stock <= 0}
                      onChange={(e) =>
                        setSeleccion((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(p.sku);
                          else n.delete(p.sku);
                          return n;
                        })
                      }
                    />
                    <span className="sr-only">Seleccionar {p.nombre}</span>
                  </label>
                )}
                <TarjetaProducto producto={p} origen="RECOMENDACION" />
              </li>
            ))}
          </ul>
          {seleccionMultiple && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 rounded-xl bg-white p-3">
              <p className="text-sm text-slate-700">
                <Icono nombre="playlist_add_check" /> {elegidos.length} seleccionados · <strong>{precio(elegidos.reduce((s, p) => s + p.precio, 0))}</strong>
              </p>
              <button
                type="button"
                className="btn-primario"
                disabled={elegidos.length === 0}
                onClick={() => {
                  for (const p of elegidos) agregar(p, "RECOMENDACION", p.posicion);
                  avisar(`${elegidos.length} producto(s) recomendados agregados al carrito`);
                  setSeleccion(new Set());
                }}
              >
                <Icono nombre="add_shopping_cart" /> Agregar seleccionados
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
