"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Icono } from "@/components/icono";
import { useTienda } from "@/contexto/tienda";
import { CLAVE_SESION, ErrorApi } from "@/lib/api-cliente";
import { fechaHora } from "@/lib/formato";
import type { Modo } from "@/lib/tipos";
import { mensajeError, useAdmin, useDatos } from "./contexto";
import { OpcionTarjeta } from "./recomendador";
import type { SesionEval } from "./tipos";
import { Alerta, CabeceraPagina, Cargando, ChipCondicion, Dato, Seccion, Tabla, Td, Th, Vacio, type TipoAlerta } from "./ui";

const ESCENARIOS = ["ESC-01", "ESC-02", "ESC-03", "ESC-04", "ESC-05", "ESC-06", "ESC-07", "ESC-08"];
const PATRON_CLIENTE = /^CLI-\d{3,4}$/;

// ---- vínculo de este navegador con la sesión (localStorage[CLAVE_SESION]) ----
const EVENTO_VINCULO = "ferremax:vinculo-sesion";
function suscribir(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENTO_VINCULO, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENTO_VINCULO, cb);
  };
}
function leerVinculo(): string | null {
  try {
    const v = localStorage.getItem(CLAVE_SESION);
    return v ? ((JSON.parse(v) as { id_sesion?: string }).id_sesion ?? null) : null;
  } catch {
    return null;
  }
}
function escribirVinculo(valor: { id_sesion: string; token: string } | null) {
  try {
    if (valor) localStorage.setItem(CLAVE_SESION, JSON.stringify(valor));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    // almacenamiento no disponible
  }
  window.dispatchEvent(new Event(EVENTO_VINCULO));
}

type Mensaje = { tipo: TipoAlerta; texto: string } | null;

export function VistaConfiguracion() {
  const { llamar, recargarConfig } = useAdmin();
  const { refrescarSesion } = useTienda();
  const sesiones = useDatos<SesionEval[]>("/api/admin/sesiones");
  const vinculada = useSyncExternalStore(suscribir, leerVinculo, () => null);
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [finalizando, setFinalizando] = useState<boolean | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  const activa = sesiones.datos?.find((s) => !s.fin) ?? null;

  async function finalizar(valida: boolean) {
    if (!activa) return;
    setFinalizando(valida);
    setMensaje(null);
    try {
      await llamar("/api/admin/sesiones", { metodo: "PUT", cuerpo: { id_sesion: activa.id_sesion, valida } });
      escribirVinculo(null);
      refrescarSesion();
      setMensaje({ tipo: "ok", texto: `Sesión ${activa.id_sesion} finalizada como ${valida ? "válida" : "inválida"}.` });
      sesiones.recargar();
    } catch (err) {
      setMensaje({ tipo: "error", texto: `No se pudo finalizar la sesión: ${mensajeError(err)}` });
    } finally {
      setFinalizando(null);
    }
  }

  function alIniciar(s: SesionEval, token: string) {
    escribirVinculo({ id_sesion: s.id_sesion, token });
    refrescarSesion();
    recargarConfig();
    sesiones.recargar();
    setMensaje({ tipo: "ok", texto: `Sesión ${s.id_sesion} iniciada y vinculada a este navegador. Modo activo fijado en ${s.condicion}.` });
  }

  const lista = sesiones.datos ?? [];
  const mostradas = verTodas ? lista : lista.slice(0, 10);

  return (
    <div className="space-y-6">
      <CabeceraPagina titulo="Configuración" subtitulo="Sesiones de evaluación con participantes (protocolo de prueba comparativa CONV vs ML)" />
      <div aria-live="polite">
        {mensaje && (
          <Alerta tipo={mensaje.tipo} alCerrar={() => setMensaje(null)}>
            {mensaje.texto}
          </Alerta>
        )}
      </div>
      {sesiones.error && <Alerta tipo="error">No se pudieron cargar las sesiones: {sesiones.error}</Alerta>}

      <Seccion
        id="sec-activa"
        icono="assignment_turned_in"
        titulo="Sesión de evaluación"
        subtitulo="Al iniciar una sesión, este navegador queda vinculado como dispositivo del participante"
        acciones={
          sesiones.datos && (
            <span className={`chip ${activa ? "bg-acento-100 text-acento-800" : "bg-emerald-100 text-emerald-900"}`}>
              <Icono nombre={activa ? "radio_button_checked" : "check_circle"} className="text-sm" />
              {activa ? "Sesión en curso" : "Listo para registrar"}
            </span>
          )
        }
      >
        {sesiones.cargando && !sesiones.datos ? (
          <Cargando />
        ) : activa ? (
          <div className="space-y-4 rounded-lg border-2 border-acento-700 bg-acento-50 p-4">
            <p className="font-mono text-lg font-bold text-marca-900">{activa.id_sesion}</p>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Dato etiqueta="Cliente">{activa.codigo_cliente}</Dato>
              <Dato etiqueta="Escenario">{activa.escenario}</Dato>
              <Dato etiqueta="Condición">
                <ChipCondicion valor={activa.condicion} />
              </Dato>
              <Dato etiqueta="Orden">{activa.orden}</Dato>
              <Dato etiqueta="Inicio">{fechaHora(activa.inicio)}</Dato>
            </dl>
            {vinculada === activa.id_sesion ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                <Icono nombre="link" /> Vinculada a este navegador: aquí se registran sus eventos.
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-medium text-red-800">
                <Icono nombre="link_off" /> No vinculada a este navegador: los eventos de esta tienda no se asocian a la sesión.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {vinculada === activa.id_sesion && (
                <Link href="/" className="btn-primario">
                  <Icono nombre="storefront" /> Abrir la tienda como participante
                </Link>
              )}
              <button type="button" className="btn-marca" onClick={() => finalizar(true)} disabled={finalizando !== null}>
                <Icono nombre="stop" /> {finalizando === true ? "Finalizando…" : "Finalizar como válida"}
              </button>
              <button type="button" className="btn-secundario border-red-300 text-red-800 hover:bg-red-50" onClick={() => finalizar(false)} disabled={finalizando !== null}>
                <Icono nombre="block" /> {finalizando === false ? "Finalizando…" : "Finalizar como inválida"}
              </button>
            </div>
          </div>
        ) : sesiones.datos ? (
          <FormularioSesion alIniciar={alIniciar} />
        ) : null}
      </Seccion>

      <Seccion
        id="sec-historial"
        icono="history"
        titulo="Sesiones registradas"
        subtitulo="De la más reciente a la más antigua"
        acciones={sesiones.datos && <span className="chip bg-slate-100 text-slate-800">{lista.length} registradas</span>}
      >
        {sesiones.cargando && !sesiones.datos ? (
          <Cargando />
        ) : sesiones.datos && lista.length === 0 ? (
          <Vacio>Sin datos: aún no se ha registrado ninguna sesión de evaluación.</Vacio>
        ) : sesiones.datos ? (
          <>
            <Tabla titulo="Sesiones de evaluación registradas">
              <thead>
                <tr>
                  <Th>Sesión</Th>
                  <Th>Cliente</Th>
                  <Th>Escenario</Th>
                  <Th>Condición</Th>
                  <Th>Orden</Th>
                  <Th>Inicio</Th>
                  <Th>Fin</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {mostradas.map((s) => (
                  <tr key={s.id_sesion}>
                    <Td mono>{s.id_sesion}</Td>
                    <Td mono>{s.codigo_cliente}</Td>
                    <Td className="max-w-48 whitespace-normal">{s.escenario}</Td>
                    <Td>
                      <ChipCondicion valor={s.condicion} />
                    </Td>
                    <Td>{s.orden}</Td>
                    <Td className="whitespace-nowrap">{fechaHora(s.inicio)}</Td>
                    <Td className="whitespace-nowrap">{s.fin ? fechaHora(s.fin) : "En curso"}</Td>
                    <Td>
                      <Estado s={s} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
            {lista.length > 10 && (
              <button type="button" className="btn-secundario mt-3" onClick={() => setVerTodas((v) => !v)} aria-expanded={verTodas}>
                {verTodas ? "Ver menos" : `Ver todas (${lista.length})`}
              </button>
            )}
          </>
        ) : null}
      </Seccion>
    </div>
  );
}

function Estado({ s }: { s: SesionEval }) {
  if (!s.fin) return <span className="chip bg-acento-100 text-acento-800">Activa</span>;
  return (
    <span className="flex flex-wrap gap-1">
      <span className={`chip ${s.valida ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>{s.valida ? "Válida" : "Inválida"}</span>
      {s.completa !== undefined && s.completa !== null && (
        <span className={`chip ${s.completa ? "bg-slate-100 text-slate-800" : "bg-amber-100 text-amber-900"}`}>{s.completa ? "Completa" : "Sin pedido"}</span>
      )}
    </span>
  );
}

function FormularioSesion({ alIniciar }: { alIniciar: (s: SesionEval, token: string) => void }) {
  const { llamar } = useAdmin();
  const [codigo, setCodigo] = useState("");
  const [escenario, setEscenario] = useState(ESCENARIOS[0]);
  const [condicion, setCondicion] = useState<Modo>("CONV");
  const [orden, setOrden] = useState<"A" | "B">("A");
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = PATRON_CLIENTE.test(codigo);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setTocado(true);
    if (!valido) {
      setError("El código de cliente debe tener el formato CLI-### o CLI-#### (por ejemplo, CLI-0007).");
      document.getElementById("ses-codigo")?.focus();
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await llamar<{ sesion: SesionEval; token_dispositivo: string }>("/api/admin/sesiones", {
        cuerpo: { codigo_cliente: codigo, escenario, condicion, orden },
      });
      alIniciar(r.sesion, r.token_dispositivo);
    } catch (err) {
      setError(err instanceof ErrorApi && err.estado === 409 ? err.message : `No se pudo iniciar la sesión: ${mensajeError(err)}`);
      setEnviando(false);
    }
  }

  const invalido = tocado && !valido;
  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="ses-codigo" className="mb-1 block text-sm font-medium">
            Código de cliente
          </label>
          <input
            id="ses-codigo"
            className={`campo font-mono ${invalido ? "border-red-600" : ""}`}
            placeholder="CLI-0007"
            autoCapitalize="characters"
            autoComplete="off"
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().trim())}
            onBlur={() => setTocado(true)}
            aria-invalid={invalido}
            aria-describedby="ses-codigo-ayuda"
          />
          <p id="ses-codigo-ayuda" className={`mt-1 text-xs ${invalido ? "text-red-800" : "text-slate-600"}`}>
            {invalido ? "Formato CLI-### o CLI-####" : "Participante (código anonimizado)"}
          </p>
        </div>
        <div>
          <label htmlFor="ses-escenario" className="mb-1 block text-sm font-medium">
            Escenario de prueba
          </label>
          <select id="ses-escenario" className="campo" value={escenario} onChange={(e) => setEscenario(e.target.value)}>
            {ESCENARIOS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ses-condicion" className="mb-1 block text-sm font-medium">
            Condición de esta sesión
          </label>
          <select id="ses-condicion" className="campo" value={condicion} onChange={(e) => setCondicion(e.target.value as Modo)}>
            <option value="CONV">CONV · Convencional</option>
            <option value="ML">ML · Machine Learning</option>
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Orden de condiciones (contrabalanceo)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <OpcionTarjeta nombre="orden" valor="A" marcado={orden === "A"} alCambiar={() => setOrden("A")} titulo="A: Convencional → ML" detalle="Grupo de control primero" />
          <OpcionTarjeta nombre="orden" valor="B" marcado={orden === "B"} alCambiar={() => setOrden("B")} titulo="B: ML → Convencional" detalle="Grupo experimental primero" />
        </div>
      </fieldset>
      <div aria-live="assertive">{error && <Alerta tipo="error">{error}</Alerta>}</div>
      <button type="submit" className="btn-primario" disabled={enviando}>
        <Icono nombre={enviando ? "progress_activity" : "play_arrow"} className={enviando ? "animate-spin" : ""} />
        {enviando ? "Iniciando…" : "Iniciar sesión de evaluación"}
      </button>
      <p className="text-xs text-slate-600">Al iniciar, el modo activo de la tienda se fija en la condición elegida y este navegador queda vinculado como dispositivo del participante.</p>
    </form>
  );
}
