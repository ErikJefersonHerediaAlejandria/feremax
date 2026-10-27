"use client";

import { useEffect, useState } from "react";
import { Icono } from "@/components/icono";
import { fechaHora } from "@/lib/formato";
import { mensajeError, useAdmin, useDatos } from "./contexto";
import { GraficoBarras, type Serie } from "./grafico-barras";
import { CONDICIONES, TablaIndicadores } from "./resumen";
import type { EvaluacionOffline, Indicadores, McNemar, MetricasSesion, Resumen } from "./tipos";
import { Alerta, CabeceraPagina, Cargando, ChipCondicion, Dato, entero, num, pct, pValor, Seccion, siNo, Tabla, Td, Th, Vacio, type TipoAlerta } from "./ui";

const NOMBRE_MODO: Record<string, string> = {
  POPULARIDAD: "Popularidad (referencia)",
  CONV: "CONV · reglas de asociación",
  ML_REGLAS: "ML · solo reglas",
  ML_COMPLETO: "ML · completo",
};
const nombreModo = (m: string) => NOMBRE_MODO[m] ?? m;

// Paleta validada (scripts/validate_palette.js de la guía de visualización): ΔE CVD 21,8; contraste ≥ 3:1.
const SERIES: Serie[] = [
  { nombre: "Precision@5 (media)", color: "#2f5f9e" },
  { nombre: "Recall@5 (media)", color: "#dc5a12", rayado: true },
];

export function VistaEvaluacion() {
  return (
    <div className="space-y-6">
      <CabeceraPagina titulo="Evaluación del recomendador" subtitulo="Comparación entre el modo convencional (reglas de asociación) y el modo Machine Learning (reordenador LightGBM)" />
      <CapaOffline />
      <CapaSesiones />
    </div>
  );
}

// ---------- Capa 1 ----------

function CapaOffline() {
  const { llamar } = useAdmin();
  const ev = useDatos<EvaluacionOffline | null>("/api/admin/evaluacion-offline");
  const [inicio, setInicio] = useState<number | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [mensaje, setMensaje] = useState<{ tipo: TipoAlerta; texto: string } | null>(null);

  useEffect(() => {
    if (inicio === null) return;
    const id = setInterval(() => setSegundos(Math.round((Date.now() - inicio) / 1000)), 1000);
    return () => clearInterval(id);
  }, [inicio]);

  async function recalcular() {
    setInicio(Date.now());
    setSegundos(0);
    setMensaje(null);
    try {
      const r = await llamar<EvaluacionOffline>("/api/admin/evaluacion-offline", { metodo: "POST" });
      ev.setDatos(r);
      setMensaje({ tipo: "ok", texto: `Evaluación offline terminada (${r.fecha_corrida ?? "sin fecha"} UTC).` });
    } catch (err) {
      setMensaje({ tipo: "error", texto: `No se pudo ejecutar la evaluación offline: ${mensajeError(err)}` });
    } finally {
      setInicio(null);
    }
  }

  const enCurso = inicio !== null;
  const d = ev.datos;
  return (
    <Seccion
      id="capa1"
      icono="science"
      titulo="Evaluación offline · Capa 1"
      subtitulo="Comprobantes históricos con partición temporal (GET/POST /api/admin/evaluacion-offline)"
      acciones={
        <button type="button" className="btn-marca" onClick={recalcular} disabled={enCurso}>
          <Icono nombre={enCurso ? "progress_activity" : "refresh"} className={enCurso ? "animate-spin" : ""} />
          {enCurso ? "Recalculando…" : "Recalcular métricas"}
        </button>
      }
    >
      <div className="mb-4 space-y-2" aria-live="polite">
        {enCurso && (
          <Alerta tipo="info">
            Ejecutando la evaluación offline… ({segundos} s; suele tardar unos 15 s)
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sky-100" aria-hidden="true">
              <span className="block h-full rounded-full bg-sky-700 transition-[width] duration-1000" style={{ width: `${Math.min(95, (segundos / 15) * 100)}%` }} />
            </span>
          </Alerta>
        )}
        {mensaje && (
          <Alerta tipo={mensaje.tipo} alCerrar={() => setMensaje(null)}>
            {mensaje.texto}
          </Alerta>
        )}
      </div>
      {ev.cargando && d === undefined ? (
        <Cargando />
      ) : ev.error ? (
        <Alerta tipo="error">No se pudo cargar la evaluación offline: {ev.error}</Alerta>
      ) : !d ? (
        <Vacio>Sin datos: la evaluación offline aún no se ha ejecutado. Use «Recalcular métricas».</Vacio>
      ) : (
        <ResultadoOffline d={d} />
      )}
    </Seccion>
  );
}

function ResultadoOffline({ d }: { d: EvaluacionOffline }) {
  const modos = d.modos?.length ? d.modos : Object.keys(d.por_modo ?? {});
  const real = d.fuente_datos === "empresa";
  const u = d.umbrales;
  const ap = d.reordenador?.ap_validacion;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-marca-900">
          <Icono nombre="description" /> Ficha de la corrida
        </h3>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Fecha de la corrida (UTC)">{d.fecha_corrida}</Dato>
          <Dato etiqueta="Partición">{d.particion}</Dato>
          <Dato etiqueta="Protocolo">{d.protocolo}</Dato>
          <Dato etiqueta="Contextos de prueba evaluados (n)">
            {entero(d.n_prueba_evaluados)}
            {d.n_boletas_prueba_evaluadas !== undefined && ` de ${entero(d.n_boletas_prueba_evaluadas)} comprobantes con ≥ 2 productos`}
          </Dato>
          <Dato etiqueta="Comprobantes (entrenamiento / prueba / total)">
            {entero(d.n_entrenamiento)} / {entero(d.n_prueba_total)} / {entero(d.n_comprobantes)}
          </Dato>
          <Dato etiqueta="Periodo de entrenamiento">{d.periodo_entrenamiento ? `${d.periodo_entrenamiento[0]} → ${d.periodo_entrenamiento[1]}` : "—"}</Dato>
          <Dato etiqueta="Periodo de prueba">{d.periodo_prueba ? `${d.periodo_prueba[0]} → ${d.periodo_prueba[1]}` : "—"}</Dato>
          <Dato etiqueta="k · semilla">
            {d.k ?? "—"} · {d.semilla ?? "—"}
          </Dato>
          <Dato etiqueta="Umbrales">{u ? `soporte ≥ ${u.soporte_min} · confianza ≥ ${u.confianza_min} · lift ≥ ${u.lift_min}` : "—"}</Dato>
          <Dato etiqueta="Reglas entrenadas">{entero(d.reglas_entrenadas)}</Dato>
          <Dato etiqueta="Filtrado colaborativo">{d.cf_productos != null ? `${entero(d.cf_productos)} productos · ${entero(d.cf_clientes)} clientes` : "—"}</Dato>
          <Dato etiqueta="Reordenador">
            {d.reordenador ? `${d.reordenador.tipo ?? "—"} · ${entero(d.reordenador.n_ejemplos)} ejemplos (${entero(d.reordenador.n_positivos)} positivos)` : "—"}
          </Dato>
          <Dato etiqueta="AP validación temporal">{ap ? Object.entries(ap).map(([k, v]) => `${k} ${num(v, 4)}`).join(" · ") : "—"}</Dato>
          <Dato etiqueta="Cobertura de candidatos (prueba)">{pct(d.cobertura_candidatos_prueba)}</Dato>
          <Dato etiqueta="Peso de contenido">{d.peso_contenido ?? "—"}</Dato>
          <Dato etiqueta="Fuente de datos">{real ? "Ventas reales de la empresa (anonimizadas)" : `Datos simulados del prototipo${d.fuente_datos ? ` (${d.fuente_datos})` : ""}`}</Dato>
          {d.csv && (
            <Dato etiqueta="CSV por contexto">
              <span className="font-mono text-xs">{d.csv}</span>
            </Dato>
          )}
        </dl>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold text-marca-900">Precision@5 y Recall@5 por modo</h3>
        <p className="mb-3 text-xs text-slate-600">P@5 = |top-5 ∩ relevantes| / 5 · R@5 = |top-5 ∩ relevantes| / |relevantes| · acierto = al menos un relevante en el top-5.</p>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <GraficoBarras
            titulo="Comparativa de medias por modo (offline)"
            descripcion={`Barras horizontales agrupadas: Precision@5 y Recall@5 medias de ${modos.length} modos, eje de 0 en adelante.`}
            series={SERIES}
            grupos={modos.map((m) => ({ etiqueta: nombreModo(m), valores: [d.por_modo[m]?.precision5?.media, d.por_modo[m]?.recall5?.media] }))}
          />
          <Tabla titulo="Estadísticos de Precision@5 y Recall@5 por modo">
            <thead>
              <tr>
                <Th>Modo</Th>
                <Th>Métrica</Th>
                <Th derecha>n</Th>
                <Th derecha>Media</Th>
                <Th derecha>Mediana</Th>
                <Th derecha>DE</Th>
                <Th derecha>Mín.</Th>
                <Th derecha>Máx.</Th>
                <Th derecha>Aciertos</Th>
              </tr>
            </thead>
            <tbody>
              {modos.flatMap((m) =>
                (["precision5", "recall5"] as const).map((k, i) => {
                  const r: Resumen | undefined = d.por_modo[m]?.[k];
                  return (
                    <tr key={`${m}-${k}`}>
                      <Td>{i === 0 ? <ChipCondicion valor={m} /> : <span className="sr-only">{m}</span>}</Td>
                      <Td>{k === "precision5" ? "P@5" : "R@5"}</Td>
                      <Td derecha>{entero(r?.n)}</Td>
                      <Td derecha>{num(r?.media, 4)}</Td>
                      <Td derecha>{num(r?.mediana, 4)}</Td>
                      <Td derecha>{num(r?.de, 4)}</Td>
                      <Td derecha>{num(r?.min, 4)}</Td>
                      <Td derecha>{num(r?.max, 4)}</Td>
                      <Td derecha>{i === 0 ? entero(d.por_modo[m]?.aciertos) : ""}</Td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </Tabla>
        </div>
      </div>

      {d.mcnemar_exacto && Object.keys(d.mcnemar_exacto).length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-bold text-marca-900">McNemar exacto (pares de modos)</h3>
          <p className="mb-3 text-xs text-slate-600">Aciertos pareados por contexto de prueba; p-valor bilateral exacto (binomial sobre los pares discordantes).</p>
          <TablaMcNemar titulo="McNemar exacto entre modos offline" filas={Object.entries(d.mcnemar_exacto)} />
        </div>
      )}
      <p className="text-xs text-slate-600">
        {real ? "Ventas reales de la empresa, anonimizadas." : "Datos simulados para la demostración del prototipo; se deben recalcular con los datos reales de la empresa."} Aciertos = contextos de prueba
        en que al menos un producto relevante apareció en el top-5.
      </p>
    </div>
  );
}

function TablaMcNemar({ titulo, filas }: { titulo: string; filas: [string, McNemar][] }) {
  const conPares = filas.some(([, m]) => m.n_pares !== undefined);
  return (
    <Tabla titulo={titulo}>
      <thead>
        <tr>
          <Th>Comparación</Th>
          {conPares && <Th derecha>Pares</Th>}
          <Th derecha>Ambos aciertan</Th>
          <Th derecha>Solo el primero</Th>
          <Th derecha>Solo el segundo</Th>
          <Th derecha>Ninguno</Th>
          <Th derecha>p-valor</Th>
        </tr>
      </thead>
      <tbody>
        {filas.map(([clave, m]) => (
          <tr key={clave}>
            <Td mono>{clave.replace("_vs_", " vs ")}</Td>
            {conPares && <Td derecha>{entero(m.n_pares)}</Td>}
            <Td derecha>{entero(m.ambos)}</Td>
            <Td derecha>{entero(m.solo_primero)}</Td>
            <Td derecha>{entero(m.solo_segundo)}</Td>
            <Td derecha>{entero(m.ninguno)}</Td>
            <Td derecha className={m.p_valor < 0.05 ? "font-bold" : ""}>{pValor(m.p_valor)}</Td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

// ---------- Capa 2 ----------

const ETIQUETA_DEF: Record<string, string> = {
  precision_5: "Precision@5 de sesión",
  tiempo_seleccion_s: "Tiempo de selección",
  mcnemar: "McNemar",
};

function CapaSesiones() {
  const ind = useDatos<Indicadores>("/api/admin/indicadores");
  const d = ind.datos;
  const sesiones: MetricasSesion[] = d ? CONDICIONES.flatMap((c) => d.por_sesion?.[c] ?? []).sort((a, b) => (a.inicio < b.inicio ? 1 : -1)) : [];
  const mc = d?.mcnemar_exacto?.CONV_vs_ML;

  return (
    <Seccion
      id="capa2"
      icono="groups"
      titulo="Sesiones con clientes · Capa 2"
      subtitulo="Registro de eventos de las sesiones de evaluación (GET /api/admin/indicadores); los agregados usan solo las sesiones válidas y completas"
      acciones={
        <button type="button" className="btn-secundario" onClick={ind.recargar} disabled={ind.cargando}>
          <Icono nombre="refresh" className={ind.cargando ? "animate-spin" : ""} /> Actualizar
        </button>
      }
    >
      <div className="space-y-6">
        <TablaIndicadores estado={ind} />
        {d && (
          <>
            {d.definiciones && Object.keys(d.definiciones).length > 0 && (
              <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
                {Object.entries(d.definiciones).map(([k, v]) => (
                  <Dato key={k} etiqueta={ETIQUETA_DEF[k] ?? k}>
                    {v}
                  </Dato>
                ))}
              </dl>
            )}

            <div>
              <h3 className="mb-1 text-sm font-bold text-marca-900">McNemar exacto · CONV vs ML</h3>
              <p className="mb-3 text-xs text-slate-600">Pareado por participante: acierto = aceptó al menos una recomendación en la condición.</p>
              {mc ? <TablaMcNemar titulo="McNemar exacto entre condiciones CONV y ML" filas={[["CONV_vs_ML", mc]]} /> : <Vacio>Sin datos de McNemar.</Vacio>}
              {mc && mc.n_pares === 0 && <p className="mt-2 text-xs text-slate-600">Aún no hay participantes con sesiones válidas y completas en ambas condiciones.</p>}
            </div>

            <div>
              <h3 className="mb-1 flex flex-wrap items-center gap-2 text-sm font-bold text-marca-900">
                Indicadores por sesión <span className="chip bg-slate-100 text-slate-800">{sesiones.length} sesiones</span>
              </h3>
              <p className="mb-3 text-xs text-slate-600">Cada fila se calcula a partir de los eventos registrados de la sesión (las inválidas o incompletas no entran en los agregados).</p>
              {sesiones.length === 0 ? (
                <Vacio>Sin datos: aún no hay sesiones registradas.</Vacio>
              ) : (
                <Tabla titulo="Indicadores por sesión de evaluación">
                  <thead>
                    <tr>
                      <Th>Sesión</Th>
                      <Th>Cliente</Th>
                      <Th>Escenario</Th>
                      <Th>Condición</Th>
                      <Th>Orden</Th>
                      <Th>Inicio</Th>
                      <Th>Válida</Th>
                      <Th>Completa</Th>
                      <Th derecha>Tiempo (s)</Th>
                      <Th derecha>Listas (con P@5 = 0)</Th>
                      <Th derecha>Recs mostradas</Th>
                      <Th derecha>Recs aceptadas</Th>
                      <Th derecha>P@5</Th>
                      <Th>Acierto</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sesiones.map((s) => (
                      <tr key={s.id_sesion} className={s.valida && s.completa ? undefined : "text-slate-600"}>
                        <Td mono>{s.id_sesion}</Td>
                        <Td mono>{s.codigo_cliente}</Td>
                        <Td className="max-w-48 whitespace-normal">{s.escenario}</Td>
                        <Td>
                          <ChipCondicion valor={s.condicion} />
                        </Td>
                        <Td>{s.orden}</Td>
                        <Td className="whitespace-nowrap">{fechaHora(s.inicio)}</Td>
                        <Td>{siNo(s.valida)}</Td>
                        <Td>{siNo(s.completa)}</Td>
                        <Td derecha>{num(s.tiempo_s, 2)}</Td>
                        <Td derecha>
                          {s.listas_mostradas}
                          {s.listas_sin_oportunidad ? ` (${s.listas_sin_oportunidad})` : ""}
                        </Td>
                        <Td derecha>{s.recs_mostradas}</Td>
                        <Td derecha>{s.recs_aceptadas}</Td>
                        <Td derecha>{num(s.precision_5, 4)}</Td>
                        <Td>{siNo(s.acierto)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              )}
            </div>
          </>
        )}
      </div>
    </Seccion>
  );
}
