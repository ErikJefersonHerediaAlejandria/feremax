"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { precio, urlDetalle } from "@/lib/formato";
import type { Producto, ProductoPuntuado } from "@/lib/tipos";
import { Icono } from "../icono";
import { ImagenProducto } from "../imagen-producto";
import { BotonAgregar, EstadoStock, TarjetaProducto } from "../tarjeta-producto";
import { BusquedasFrecuentes } from "./busquedas-frecuentes";
import { Recomendaciones } from "./recomendaciones";

type Modo = "necesidad" | "categoria" | "todos";
type Orden = "relevancia" | "menor" | "mayor";

function contar(lista: Producto[], campo: "categoria" | "marca") {
  const m = new Map<string, number>();
  for (const p of lista) if (p[campo]) m.set(p[campo]!, (m.get(p[campo]!) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
}

function GrupoCasillas({ titulo, opciones, elegidas, alCambiar }: { titulo: string; opciones: [string, number][]; elegidas: Set<string>; alCambiar: (v: Set<string>) => void }) {
  return (
    <fieldset className="border-t border-slate-200 pt-4">
      <legend className="mb-2 text-sm font-bold text-marca-900">{titulo}</legend>
      {opciones.length === 0 ? (
        <p className="text-sm text-slate-600">Sin resultados que filtrar.</p>
      ) : (
        <ul className="space-y-1.5">
          {opciones.map(([valor, n]) => (
            <li key={valor}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="size-4 accent-acento-700"
                  checked={elegidas.has(valor)}
                  onChange={(e) => {
                    const s = new Set(elegidas);
                    if (e.target.checked) s.add(valor);
                    else s.delete(valor);
                    alCambiar(s);
                  }}
                />
                <span className="flex-1">{valor}</span>
                <span className="text-xs text-slate-600">{n}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

export function VistaResultados({ modo, termino, resultados }: { modo: Modo; termino: string; resultados: (Producto | ProductoPuntuado)[] }) {
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [marcas, setMarcas] = useState<Set<string>>(new Set());
  const [minimo, setMinimo] = useState("");
  const [maximo, setMaximo] = useState("");
  const [soloStock, setSoloStock] = useState(false);
  const [orden, setOrden] = useState<Orden>("relevancia");
  const [vista, setVista] = useState<"cuadricula" | "lista">("cuadricula");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const hayFiltros = categorias.size > 0 || marcas.size > 0 || minimo !== "" || maximo !== "" || soloStock;
  const limpiar = () => {
    setCategorias(new Set());
    setMarcas(new Set());
    setMinimo("");
    setMaximo("");
    setSoloStock(false);
  };

  const filtrados = useMemo(() => {
    const min = minimo === "" ? -Infinity : Number(minimo);
    const max = maximo === "" ? Infinity : Number(maximo);
    const f = resultados.filter(
      (p) =>
        (categorias.size === 0 || categorias.has(p.categoria ?? "")) &&
        (marcas.size === 0 || marcas.has(p.marca ?? "")) &&
        p.precio >= min &&
        p.precio <= max &&
        (!soloStock || p.stock > 0),
    );
    if (orden === "menor") return [...f].sort((a, b) => a.precio - b.precio);
    if (orden === "mayor") return [...f].sort((a, b) => b.precio - a.precio);
    return f;
  }, [resultados, categorias, marcas, minimo, maximo, soloStock, orden]);

  const terminos = useMemo(() => [...new Set(resultados.flatMap((p) => ("terminos" in p ? p.terminos : [])))], [resultados]);
  const origen = modo === "necesidad" ? "BUSQUEDA" : "CATEGORIA";
  const titulo = modo === "necesidad" ? <>Productos para: <q>{termino}</q></> : modo === "categoria" ? `Categoría: ${termino}` : "Todo el catálogo";

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,24rem)]">
        <section className="tarjeta p-5">
          <p className="chip mb-2 bg-marca-50 text-marca-800">
            <Icono nombre={modo === "necesidad" ? "auto_awesome" : "category"} /> {modo === "necesidad" ? "Búsqueda por necesidad" : "Navegación por categoría"}
          </p>
          <h1 className="text-2xl font-extrabold text-marca-900">{titulo}</h1>
          <p className="mt-1 text-sm text-slate-700">
            <Icono nombre="inventory_2" /> Encontramos <strong>{resultados.length === 1 ? "1 producto" : `${resultados.length} productos`}</strong>
            {modo === "necesidad" ? " relacionados con tu necesidad." : modo === "categoria" ? " en esta categoría." : " en el catálogo."}
          </p>
          <div className="mt-4">
            <BusquedasFrecuentes />
          </div>
        </section>
        <aside className="rounded-xl border border-sky-200 bg-sky-50 p-5 text-sm text-slate-800" aria-labelledby="como-ordenados">
          <h2 id="como-ordenados" className="mb-2 flex items-center gap-2 font-bold text-marca-900">
            <Icono nombre="lightbulb" className="text-acento-700" /> Cómo se ordenaron estos resultados
          </h2>
          {modo === "necesidad" ? (
            <>
              <p>
                Tu necesidad se comparó con la descripción de cada producto (nombre, uso, categoría y subcategoría), incluyendo sinónimos de ferretería, mediante
                similitud TF-IDF; primero los más parecidos.
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-1">
                <Icono nombre="check_circle" className="text-emerald-700" /> Términos reconocidos:{" "}
                {terminos.length ? terminos.map((t) => <span key={t} className="chip bg-white text-marca-800">{t}</span>) : <em>ninguno</em>}
              </p>
            </>
          ) : (
            <p>Productos {modo === "categoria" ? "de la categoría elegida" : "del catálogo"}, ordenados del más vendido al menos vendido.</p>
          )}
        </aside>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <div>
          <button type="button" className="btn-secundario w-full lg:hidden" aria-expanded={filtrosAbiertos} aria-controls="filtros" onClick={() => setFiltrosAbiertos((v) => !v)}>
            <Icono nombre="tune" /> Filtros {hayFiltros && <span className="size-2 rounded-full bg-acento-600" aria-label="(activos)" />}
            <Icono nombre={filtrosAbiertos ? "expand_less" : "expand_more"} />
          </button>
          <aside id="filtros" className={`tarjeta mt-3 space-y-4 p-4 lg:mt-0 lg:block ${filtrosAbiertos ? "block" : "hidden"}`} aria-label="Filtros">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-marca-900">Filtros</h2>
              <button type="button" className="text-sm font-semibold text-acento-800 underline disabled:no-underline disabled:opacity-50" onClick={limpiar} disabled={!hayFiltros}>
                Limpiar todo
              </button>
            </div>
            <GrupoCasillas titulo="Categoría" opciones={contar(resultados, "categoria")} elegidas={categorias} alCambiar={setCategorias} />
            <GrupoCasillas titulo="Marca" opciones={contar(resultados, "marca")} elegidas={marcas} alCambiar={setMarcas} />
            <fieldset className="border-t border-slate-200 pt-4">
              <legend className="mb-2 text-sm font-bold text-marca-900">Rango de precio (S/)</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-700">
                  Mínimo
                  <input id="precio-min" type="number" min={0} inputMode="decimal" className="campo mt-1" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
                </label>
                <label className="text-xs text-slate-700">
                  Máximo
                  <input id="precio-max" type="number" min={0} inputMode="decimal" className="campo mt-1" value={maximo} onChange={(e) => setMaximo(e.target.value)} />
                </label>
              </div>
            </fieldset>
            <label className="flex cursor-pointer items-start gap-3 border-t border-slate-200 pt-4 text-sm">
              <input type="checkbox" role="switch" className="mt-0.5 size-4 accent-acento-700" checked={soloStock} onChange={(e) => setSoloStock(e.target.checked)} />
              <span>
                <strong className="block text-marca-900">Solo productos en stock</strong>
                <span className="text-slate-600">Oculta los productos agotados</span>
              </span>
            </label>
          </aside>
        </div>

        <section aria-label="Resultados">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-700" role="status">
              {hayFiltros ? `${filtrados.length} de ${resultados.length} resultados` : resultados.length === 1 ? "1 resultado encontrado" : `${resultados.length} resultados encontrados`}
            </p>
            <label htmlFor="orden" className="ml-auto text-sm text-slate-700">
              Ordenar por:
            </label>
            <select id="orden" className="campo w-auto py-2" value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
              <option value="relevancia">{modo === "necesidad" ? "Relevancia por necesidad" : "Más vendidos"}</option>
              <option value="menor">Menor precio</option>
              <option value="mayor">Mayor precio</option>
            </select>
            <div className="flex rounded-lg border border-slate-300 bg-white" role="group" aria-label="Vista">
              {(["cuadricula", "lista"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={vista === v}
                  title={v === "cuadricula" ? "Vista en cuadrícula" : "Vista en lista"}
                  className={`px-2.5 py-1.5 ${vista === v ? "bg-marca-900 text-white" : "text-marca-900"}`}
                  onClick={() => setVista(v)}
                >
                  <Icono nombre={v === "cuadricula" ? "grid_view" : "view_list"} etiqueta={v === "cuadricula" ? "Vista en cuadrícula" : "Vista en lista"} />
                </button>
              ))}
            </div>
          </div>

          {resultados.length === 0 ? (
            <div className="tarjeta p-10 text-center">
              <Icono nombre="search_off" className="text-5xl text-slate-500" />
              <p className="mt-2 font-bold text-marca-900">No encontramos productos para «{termino}»</p>
              <p className="text-sm text-slate-700">Prueba describiendo tu necesidad con otras palabras o explora una categoría.</p>
            </div>
          ) : filtrados.length === 0 ? (
            <p className="tarjeta p-8 text-center text-slate-700">
              Ningún resultado cumple los filtros elegidos.{" "}
              <button type="button" className="font-semibold text-acento-800 underline" onClick={limpiar}>
                Limpiar filtros
              </button>
            </p>
          ) : vista === "cuadricula" ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtrados.map((p, i) => (
                <li key={p.sku}>
                  <TarjetaProducto producto={p} origen={origen} prioridad={i < 2}>
                    <Coincidencias producto={p} />
                  </TarjetaProducto>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-3">
              {filtrados.map((p) => (
                <li key={p.sku} className="tarjeta flex gap-3 p-3">
                  <Link href={urlDetalle(p.sku, origen)} className="w-24 shrink-0 sm:w-32" tabIndex={-1} aria-hidden="true">
                    <ImagenProducto sku={p.sku} nombre={p.nombre} categoria={p.categoria} sizes="128px" />
                  </Link>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-xs font-bold uppercase text-slate-600">
                      {p.marca} · SKU: {p.sku}
                    </span>
                    <Link href={urlDetalle(p.sku, origen)} className="font-semibold text-marca-900 hover:underline">
                      {p.nombre}
                    </Link>
                    <Coincidencias producto={p} />
                    <EstadoStock stock={p.stock} />
                  </div>
                  <div className="flex flex-col items-end justify-between gap-2">
                    <span className="text-lg font-extrabold text-marca-900">{precio(p.precio)}</span>
                    <BotonAgregar producto={p} origen={origen} compacto />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {modo === "necesidad" && resultados.length > 0 && (
        <div className="mt-10">
          <Recomendaciones
            contexto="busqueda"
            skus={[resultados[0].sku]}
            titulo={`Productos que suelen acompañar a «${resultados[0].nombre}»`}
            subtitulo="Complementos sugeridos para el primer resultado de tu búsqueda."
          />
        </div>
      )}
    </>
  );
}

function Coincidencias({ producto }: { producto: Producto | ProductoPuntuado }) {
  if (!("terminos" in producto) || !producto.terminos.length) {
    return producto.subcategoria ? <span className="chip w-fit bg-marca-50 text-marca-800">{producto.subcategoria}</span> : null;
  }
  return (
    <span className="chip w-fit bg-emerald-50 text-emerald-900">
      <Icono nombre="search_check" /> Coincide con: {producto.terminos.join(", ")}
    </span>
  );
}
