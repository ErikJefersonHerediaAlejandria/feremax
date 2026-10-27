"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icono } from "@/components/icono";
import type { Modo, Producto } from "@/lib/tipos";
import { mensajeError, useAdmin, useDatos } from "./contexto";
import type { ConfigAdmin, Regla, Reordenador, RespuestaReentrenar, SesionEval, VarianteMl } from "./tipos";
import { Alerta, CabeceraPagina, Cargando, Dato, descargarCsv, entero, num, parSkus, pct, Seccion, Tabla, Td, Th, Vacio, type TipoAlerta } from "./ui";

type Mensaje = { tipo: TipoAlerta; texto: string } | null;

export function VistaRecomendador() {
  const { config, conexion, recargarConfig } = useAdmin();
  return (
    <div className="space-y-6">
      <CabeceraPagina titulo="Recomendador" subtitulo="Modo activo, parámetros del modelo, reentrenamiento y reglas de asociación vigentes" />
      {config ? (
        <FormularioConfig key={config.id ?? 0} config={config} />
      ) : conexion === "sin-conexion" ? (
        <Alerta tipo="error">
          No se pudo leer la configuración del recomendador.{" "}
          <button type="button" className="font-semibold underline" onClick={recargarConfig}>
            Reintentar
          </button>
        </Alerta>
      ) : (
        <Cargando texto="Cargando configuración…" />
      )}
      <ModeloActual />
      <ReglasVigentes />
    </div>
  );
}

// ---------- Parámetros ----------

const CAMPOS = [
  { clave: "k", etiqueta: "k (recomendaciones por lista)", paso: "1", min: 1, max: 20, entero: true },
  { clave: "soporte_min", etiqueta: "Soporte mínimo", paso: "0.001", min: 0.001, max: 1 },
  { clave: "confianza_min", etiqueta: "Confianza mínima", paso: "0.01", min: 0, max: 1 },
  { clave: "lift_min", etiqueta: "Lift mínimo", paso: "0.1", min: 0, max: 100 },
  { clave: "peso_contenido", etiqueta: "Peso de contenido (reordenador ML; 1 = neutro)", paso: "0.05", min: 0, max: 5 },
] as const;
type ClaveNum = (typeof CAMPOS)[number]["clave"];

const MODOS: { valor: Modo; titulo: string; detalle: string; icono: string }[] = [
  { valor: "CONV", titulo: "Convencional", detalle: "Reglas de asociación y más vendidos de la categoría", icono: "equalizer" },
  { valor: "ML", titulo: "Machine Learning", detalle: "Reordenador LightGBM sobre reglas, filtrado colaborativo y contenido", icono: "auto_awesome" },
];
const VARIANTES: { valor: VarianteMl; titulo: string; detalle: string }[] = [
  { valor: "COMPLETO", titulo: "COMPLETO", detalle: "Reglas + filtrado colaborativo + contenido + reordenador" },
  { valor: "REGLAS", titulo: "REGLAS", detalle: "Solo candidatos de reglas FP-Growth + reordenador" },
];

function FormularioConfig({ config }: { config: ConfigAdmin }) {
  const { llamar, setConfig } = useAdmin();
  const [modo, setModo] = useState<Modo>(config.modo_activo);
  const [variante, setVariante] = useState<VarianteMl>(config.variante_ml);
  const [valores, setValores] = useState<Record<ClaveNum, string>>(() =>
    Object.fromEntries(CAMPOS.map((c) => [c.clave, String(config[c.clave])])) as Record<ClaveNum, string>,
  );
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const cuerpo: Record<string, unknown> = { modo_activo: modo, variante_ml: variante };
    for (const c of CAMPOS) {
      const v = Number(valores[c.clave].replace(",", "."));
      if (valores[c.clave].trim() === "" || !Number.isFinite(v) || ("entero" in c && !Number.isInteger(v)) || v < c.min || v > c.max) {
        setMensaje({ tipo: "error", texto: `El campo "${c.etiqueta}" debe ser un número entre ${c.min} y ${c.max}.` });
        document.getElementById(`cfg-${c.clave}`)?.focus();
        return;
      }
      cuerpo[c.clave] = v;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      const [nueva, sesiones] = await Promise.all([
        llamar<ConfigAdmin>("/api/admin/config", { metodo: "PUT", cuerpo }),
        llamar<SesionEval[]>("/api/admin/sesiones").catch(() => [] as SesionEval[]),
      ]);
      setConfig(nueva);
      const activa = sesiones.find((s) => !s.fin);
      setMensaje(
        activa && activa.condicion !== nueva.modo_activo
          ? { tipo: "error", texto: `Configuración guardada (modo ${nueva.modo_activo}). Atención: la sesión activa ${activa.id_sesion} tiene condición ${activa.condicion}.` }
          : { tipo: "ok", texto: `Configuración guardada. Modo activo: ${nueva.modo_activo} · variante ML: ${nueva.variante_ml}.` },
      );
    } catch (err) {
      setMensaje({ tipo: "error", texto: `No se pudo guardar: ${mensajeError(err)}` });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion id="sec-config" icono="toggle_on" titulo="Modo activo y parámetros" subtitulo="Motor de recomendación desplegado en la tienda y umbrales del modelo">
      <form onSubmit={guardar} className="space-y-5" noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-800">Modo activo del sistema</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODOS.map((m) => (
              <OpcionTarjeta key={m.valor} nombre="modo" valor={m.valor} marcado={modo === m.valor} alCambiar={() => setModo(m.valor)} icono={m.icono} titulo={`${m.valor} · ${m.titulo}`} detalle={m.detalle} />
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600">
            <Icono nombre="info" className="text-sm" /> El modo activo se aplica a toda la tienda. Al iniciar una sesión de evaluación, el modo se fija en la condición de la sesión.
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS.map((c) => (
            <div key={c.clave}>
              <label htmlFor={`cfg-${c.clave}`} className="mb-1 block text-sm font-medium">
                {c.etiqueta}
              </label>
              <input
                id={`cfg-${c.clave}`}
                type="number"
                inputMode="decimal"
                className="campo"
                step={c.paso}
                min={c.min}
                max={c.max}
                required
                value={valores[c.clave]}
                onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}
                aria-describedby={`cfg-${c.clave}-rango`}
              />
              <p id={`cfg-${c.clave}-rango`} className="mt-1 text-xs text-slate-600">
                Rango {c.min}–{c.max}
              </p>
            </div>
          ))}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-800">Variante del modo ML</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {VARIANTES.map((v) => (
              <OpcionTarjeta key={v.valor} nombre="variante" valor={v.valor} marcado={variante === v.valor} alCambiar={() => setVariante(v.valor)} icono="schema" titulo={v.titulo} detalle={v.detalle} />
            ))}
          </div>
        </fieldset>

        <p className="text-xs text-slate-600">Los umbrales se aplican al filtrar las reglas vigentes y al reentrenar el modelo.</p>
        <div aria-live="polite">{mensaje && <Alerta tipo={mensaje.tipo} alCerrar={() => setMensaje(null)}>{mensaje.texto}</Alerta>}</div>
        <button type="submit" className="btn-primario" disabled={guardando}>
          <Icono nombre={guardando ? "progress_activity" : "save"} className={guardando ? "animate-spin" : ""} />
          {guardando ? "Guardando…" : "Guardar configuración"}
        </button>
      </form>
    </Seccion>
  );
}

export function OpcionTarjeta(p: { nombre: string; valor: string; marcado: boolean; alCambiar: () => void; icono?: string; titulo: string; detalle: string }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-acento-600 ${
        p.marcado ? "border-acento-700 bg-acento-50" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <input type="radio" name={p.nombre} value={p.valor} checked={p.marcado} onChange={p.alCambiar} className="mt-1 size-4 accent-acento-700" />
      {p.icono && <Icono nombre={p.icono} className={`mt-0.5 ${p.marcado ? "text-acento-700" : "text-slate-600"}`} />}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-marca-900">
          {p.titulo}
          {p.marcado && <span className="chip ml-2 bg-acento-700 text-white">Seleccionado</span>}
        </span>
        <span className="block text-xs text-slate-600">{p.detalle}</span>
      </span>
    </label>
  );
}

// ---------- Modelo y reentrenamiento ----------

function ModeloActual() {
  const { config, llamar, recargarConfig } = useAdmin();
  const [inicio, setInicio] = useState<number | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [mensaje, setMensaje] = useState<Mensaje>(null);

  useEffect(() => {
    if (inicio === null) return;
    const id = setInterval(() => setSegundos(Math.round((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(id);
  }, [inicio]);

  async function reentrenar() {
    setInicio(Date.now());
    setSegundos(0);
    setMensaje(null);
    try {
      const r = await llamar<RespuestaReentrenar>("/api/admin/modelo/reentrenar", { metodo: "POST" });
      setMensaje({ tipo: r.status === "error" ? "error" : "ok", texto: r.message || "Reentrenamiento terminado." });
      recargarConfig();
      window.dispatchEvent(new Event("ferremax:reglas-actualizadas"));
    } catch (err) {
      setMensaje({ tipo: "error", texto: `No se pudo reentrenar: ${mensajeError(err)}` });
    } finally {
      setInicio(null);
    }
  }

  const r = config?.reordenador;
  const enCurso = inicio !== null;
  return (
    <Seccion
      id="sec-modelo"
      icono="schema"
      titulo="Ficha del modelo"
      subtitulo="Reordenador supervisado del modo ML (validación temporal)"
      acciones={
        <button type="button" className="btn-marca" onClick={reentrenar} disabled={enCurso} aria-describedby="reentreno-nota">
          <Icono nombre="sync" className={enCurso ? "animate-spin" : ""} />
          {enCurso ? "Reentrenando…" : "Reentrenar modelo"}
        </button>
      }
    >
      <p id="reentreno-nota" className="sr-only">
        El reentrenamiento tarda entre 10 y 20 segundos.
      </p>
      <div className="mb-4 space-y-2" aria-live="polite">
        {enCurso && (
          <Alerta tipo="info">
            Reentrenando reglas y reordenador con todos los comprobantes… ({segundos} s; suele tardar entre 10 y 20 s)
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sky-100" aria-hidden="true">
              <span className="block h-full rounded-full bg-sky-700 transition-[width] duration-1000" style={{ width: `${Math.min(95, (segundos / 20) * 100)}%` }} />
            </span>
          </Alerta>
        )}
        {mensaje && (
          <Alerta tipo={mensaje.tipo} alCerrar={() => setMensaje(null)}>
            {mensaje.texto}
          </Alerta>
        )}
      </div>
      {!config ? <Cargando /> : !r ? <Vacio>Sin entrenar: use «Reentrenar modelo».</Vacio> : <FichaModelo r={r} />}
    </Seccion>
  );
}

function FichaModelo({ r }: { r: Reordenador }) {
  const ap = r.ap_validacion ?? {};
  const variantes = Object.entries(r.por_variante ?? {});
  return (
    <div className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta="Modelo · versión">
          {r.tipo ?? "—"} · <span className="font-mono">{r.version ?? "—"}</span>
        </Dato>
        <Dato etiqueta="Entrenado (UTC)">{r.fecha ?? "—"}</Dato>
        <Dato etiqueta="Comprobantes">{entero(r.n_boletas)}</Dato>
        <Dato etiqueta="Reglas minadas">{entero(r.n_reglas)}</Dato>
        <Dato etiqueta="Ejemplos (positivos)">
          {entero(r.n_ejemplos)} ({entero(r.n_positivos)})
        </Dato>
        <Dato etiqueta="Cobertura de candidatos">{pct(r.cobertura_candidatos)}</Dato>
        <Dato etiqueta="AP validación · LightGBM">{num(ap.lightgbm, 4)}</Dato>
        <Dato etiqueta="AP validación · regresión logística">{num(ap.regresion_logistica, 4)}</Dato>
        <Dato etiqueta="Validación">{r.validacion ?? "—"}</Dato>
        <Dato etiqueta="Periodo de datos">{r.periodo ? `${r.periodo[0]} → ${r.periodo[1]}` : "—"}</Dato>
        <Dato etiqueta="Semilla">{r.semilla ?? "—"}</Dato>
        <Dato etiqueta="Variables">{r.variables?.length ?? "—"}</Dato>
      </dl>
      {r.variables && r.variables.length > 0 && (
        <details className="rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-marca-900">Variables del reordenador ({r.variables.length})</summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {r.variables.map((v) => (
              <li key={v} className="chip bg-slate-100 font-mono font-normal text-slate-800">
                {v}
              </li>
            ))}
          </ul>
        </details>
      )}
      {variantes.length > 0 && (
        <Tabla titulo="Reordenador por variante del modo ML">
          <thead>
            <tr>
              <Th>Variante</Th>
              <Th derecha>Ejemplos</Th>
              <Th derecha>Positivos</Th>
              <Th derecha>Contextos</Th>
              <Th derecha>Cobertura</Th>
              <Th derecha>AP LightGBM</Th>
              <Th derecha>AP reg. logística</Th>
              <Th derecha>Variables</Th>
            </tr>
          </thead>
          <tbody>
            {variantes.map(([v, f]) => (
              <tr key={v}>
                <Td mono>{v}</Td>
                <Td derecha>{entero(f.n_ejemplos)}</Td>
                <Td derecha>{entero(f.n_positivos)}</Td>
                <Td derecha>{entero(f.n_contextos)}</Td>
                <Td derecha>{pct(f.cobertura_candidatos)}</Td>
                <Td derecha>{num(f.ap_validacion?.lightgbm, 4)}</Td>
                <Td derecha>{num(f.ap_validacion?.regresion_logistica, 4)}</Td>
                <Td derecha>{f.variables?.length ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      <p className="text-xs text-slate-600">AP = precisión promedio en la validación temporal (último 10 % de los comprobantes de entrenamiento). Se elige LightGBM si supera a la regresión logística.</p>
    </div>
  );
}

// ---------- Reglas ----------

const POR_PAGINA = 20;

function ReglasVigentes() {
  const vigentes = useDatos<Regla[]>("/api/admin/reglas?vigentes=true");
  const todas = useDatos<Regla[]>("/api/admin/reglas");
  const productos = useDatos<Producto[]>("/api/productos");
  const [q, setQ] = useState("");
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const { recargar: recargarVigentes } = vigentes;
  const { recargar: recargarTodas } = todas;

  useEffect(() => {
    const alActualizar = () => {
      recargarVigentes();
      recargarTodas();
    };
    window.addEventListener("ferremax:reglas-actualizadas", alActualizar);
    return () => window.removeEventListener("ferremax:reglas-actualizadas", alActualizar);
  }, [recargarVigentes, recargarTodas]);

  const nombres = useMemo(() => new Map((productos.datos ?? []).map((p) => [p.sku, p.nombre])), [productos.datos]);
  const reglas = useMemo(
    () => (vigentes.datos ?? []).map((r) => ({ ...r, ant: parSkus(r.antecedentes), con: parSkus(r.consecuentes) })),
    [vigentes.datos],
  );
  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return reglas;
    return reglas.filter((r) => [...r.ant, ...r.con].some((s) => s.toLowerCase().includes(t) || nombres.get(s)?.toLowerCase().includes(t)));
  }, [reglas, q, nombres]);
  const versiones = [...new Set(reglas.map((r) => r.version_modelo).filter(Boolean))];

  function exportar() {
    const nombre = (s: string) => `${nombres.get(s) ?? s} (${s})`;
    descargarCsv(
      "reglas_vigentes.csv",
      ["id", "antecedentes", "consecuentes", "soporte", "confianza", "lift", "version_modelo"],
      filtradas.map((r) => [r.id, r.ant.map(nombre).join(" + "), r.con.map(nombre).join(" + "), r.soporte, r.confianza, r.lift, r.version_modelo]),
    );
  }

  const producto = (sku: string) => (
    <span key={sku} className="block">
      <span className="block text-slate-900">{nombres.get(sku) ?? (productos.cargando ? "…" : "Producto no encontrado")}</span>
      <span className="font-mono text-xs text-slate-600">{sku}</span>
    </span>
  );

  return (
    <Seccion
      id="sec-reglas"
      icono="hub"
      titulo="Reglas de asociación vigentes"
      subtitulo={
        <>
          Reglas que cumplen los umbrales configurados, ordenadas por confianza × lift.{" "}
          {vigentes.datos && (
            <>
              <strong>{vigentes.datos.length}</strong> vigentes{todas.datos ? ` de ${todas.datos.length} almacenadas` : ""}
              {versiones.length > 0 && ` · modelo ${versiones.join(", ")}`}.
            </>
          )}
        </>
      }
      acciones={
        <button type="button" className="btn-secundario" onClick={exportar} disabled={!filtradas.length}>
          <Icono nombre="download" /> Descargar CSV
        </button>
      }
    >
      <div className="mb-3 max-w-md">
        <label htmlFor="reglas-q" className="mb-1 block text-sm font-medium">
          Filtrar por producto o SKU
        </label>
        <input
          id="reglas-q"
          type="search"
          className="campo"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setVisibles(POR_PAGINA);
          }}
        />
      </div>
      {vigentes.error && <Alerta tipo="error">No se pudieron cargar las reglas: {vigentes.error}</Alerta>}
      {productos.error && <Alerta tipo="info">No se pudieron cargar los nombres de productos ({productos.error}); se muestran solo los SKU.</Alerta>}
      {vigentes.cargando && !vigentes.datos ? (
        <Cargando texto="Cargando reglas…" />
      ) : vigentes.datos && filtradas.length === 0 ? (
        <Vacio>Sin datos: no hay reglas vigentes{q.trim() ? " que coincidan con el filtro" : ""}.</Vacio>
      ) : vigentes.datos ? (
        <>
          <Tabla titulo="Reglas de asociación vigentes: si compra el antecedente, se recomienda el consecuente">
            <thead>
              <tr>
                <Th derecha>#</Th>
                <Th>Si compra (antecedente)</Th>
                <Th>
                  <span className="sr-only">Implica</span>
                </Th>
                <Th>Recomienda (consecuente)</Th>
                <Th derecha>Soporte</Th>
                <Th derecha>Confianza</Th>
                <Th derecha>Lift</Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(0, visibles).map((r, i) => (
                <tr key={r.id}>
                  <Td derecha>{i + 1}</Td>
                  <Td className="min-w-52 whitespace-normal">
                    <span className="space-y-1.5">
                      {r.ant.map(producto)}
                    </span>
                  </Td>
                  <Td className="text-acento-700">
                    <Icono nombre="arrow_forward" etiqueta="recomienda" />
                  </Td>
                  <Td className="min-w-52 whitespace-normal">
                    {r.con.map(producto)}
                  </Td>
                  <Td derecha>{num(r.soporte, 4)}</Td>
                  <Td derecha>{num(r.confianza, 3)}</Td>
                  <Td derecha>{num(r.lift, 2)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <p role="status">
              Mostrando {Math.min(visibles, filtradas.length)} de {filtradas.length} reglas {q.trim() ? "filtradas" : "vigentes"}
            </p>
            {visibles < filtradas.length && (
              <button type="button" className="btn-secundario" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
                Ver más
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-600">Lift &gt; 1: complementariedad por encima del azar · Confianza: frecuencia condicionada P(consecuente | antecedente) · Soporte: fracción de comprobantes con todos los productos de la regla.</p>
        </>
      ) : null}
    </Seccion>
  );
}
