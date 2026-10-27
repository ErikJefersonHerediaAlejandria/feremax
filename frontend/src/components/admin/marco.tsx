"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icono } from "@/components/icono";
import { api, ErrorApi } from "@/lib/api-cliente";
import { mensajeError, ProveedorAdmin, urlLogin, useAdmin } from "./contexto";

const GRUPOS = [
  {
    titulo: "Navegación principal",
    enlaces: [
      { href: "/admin/resumen", texto: "Resumen", icono: "dashboard" },
      { href: "/admin/inventario", texto: "Productos e inventario", icono: "inventory_2" },
      { href: "/admin/pedidos", texto: "Pedidos", icono: "receipt_long" },
      { href: "/admin/clientes", texto: "Clientes", icono: "group" },
    ],
  },
  {
    titulo: "Módulo inteligente",
    enlaces: [
      { href: "/admin/recomendador", texto: "Recomendador", icono: "psychology" },
      { href: "/admin/evaluacion", texto: "Evaluación", icono: "flaky" },
      { href: "/admin/eventos", texto: "Registro de eventos", icono: "monitoring" },
      { href: "/admin/configuracion", texto: "Configuración", icono: "settings" },
    ],
  },
] as const;

type Acceso = { estado: "verificando" } | { estado: "ok"; username: string } | { estado: "error"; mensaje: string };

/** Guard del panel: verifica la cookie de admin antes de mostrar cualquier vista. */
export function MarcoAdmin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const [acceso, setAcceso] = useState<Acceso>({ estado: "verificando" });
  const [intento, setIntento] = useState(0);
  const rutaInicial = useRef(ruta);

  useEffect(() => {
    const c = new AbortController();
    api<{ valido: boolean; username: string }>("/api/admin/verificar", { senal: c.signal }).then(
      (r) => {
        if (r.valido) setAcceso({ estado: "ok", username: r.username });
        else router.replace(urlLogin(rutaInicial.current));
      },
      (e) => {
        if (c.signal.aborted) return;
        if (e instanceof ErrorApi && e.estado === 401) router.replace(urlLogin(rutaInicial.current));
        else setAcceso({ estado: "error", mensaje: mensajeError(e) });
      },
    );
    return () => c.abort();
  }, [router, intento]);

  if (acceso.estado !== "ok") {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        {acceso.estado === "verificando" ? (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
            <Icono nombre="progress_activity" className="animate-spin" /> Verificando acceso al panel…
          </p>
        ) : (
          <div role="alert" className="tarjeta max-w-md p-6 text-center">
            <Icono nombre="cloud_off" className="text-4xl text-red-700" />
            <p className="mt-2 font-semibold text-marca-900">No se pudo verificar el acceso</p>
            <p className="mt-1 text-sm text-slate-600">{acceso.mensaje}</p>
            <button
              type="button"
              className="btn-marca mt-4"
              onClick={() => {
                setAcceso({ estado: "verificando" });
                setIntento((i) => i + 1);
              }}
            >
              <Icono nombre="refresh" /> Reintentar
            </button>
          </div>
        )}
      </main>
    );
  }

  return (
    <ProveedorAdmin username={acceso.username}>
      <Disposicion>{children}</Disposicion>
    </ProveedorAdmin>
  );
}

function Disposicion({ children }: { children: ReactNode }) {
  const { username, llamar } = useAdmin();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);

  // Drawer móvil: foco al botón de cerrar, Escape cierra y devuelve el foco al botón de menú; bloquea el scroll del fondo.
  useEffect(() => {
    if (!menuAbierto) return;
    botonCerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuAbierto(false);
        botonMenu.current?.focus();
      }
    };
    const desborde = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alTeclear);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = desborde;
    };
  }, [menuAbierto]);

  function cerrarMenu() {
    setMenuAbierto(false);
    botonMenu.current?.focus();
  }

  async function cerrarSesion() {
    setSaliendo(true);
    try {
      await llamar("/api/admin/logout", { metodo: "POST" });
    } catch {
      // aunque falle, se vuelve al login
    }
    router.replace("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-1">
      <a href="#contenido-admin" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-4 focus:py-2">
        Saltar al contenido
      </a>
      <aside className="hidden w-64 shrink-0 bg-marca-900 text-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <BarraLateral />
        </div>
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={cerrarMenu} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Menú del panel" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-marca-900 text-white shadow-xl">
            <button ref={botonCerrar} type="button" onClick={cerrarMenu} className="absolute right-2 top-3 rounded-lg p-2 text-white hover:bg-white/10" aria-label="Cerrar menú">
              <Icono nombre="close" />
            </button>
            <BarraLateral alNavegar={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-2.5 sm:px-6">
            <button
              ref={botonMenu}
              type="button"
              onClick={() => setMenuAbierto(true)}
              className="rounded-lg p-2 text-marca-900 hover:bg-slate-100 lg:hidden"
              aria-label="Abrir menú"
              aria-expanded={menuAbierto}
            >
              <Icono nombre="menu" />
            </button>
            <p className="truncate text-sm font-semibold text-marca-900 lg:hidden">Panel FerreMax</p>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <Link href="/" className="btn-secundario px-3 py-2" title="Ver tienda">
                <Icono nombre="storefront" />
                <span className="hidden sm:inline">Ver tienda</span>
                <span className="sr-only sm:hidden">Ver tienda</span>
              </Link>
              <span className="hidden items-center gap-2 px-2 text-sm text-slate-700 md:flex">
                <span className="flex size-8 items-center justify-center rounded-full bg-marca-100 text-xs font-bold uppercase text-marca-900" aria-hidden="true">
                  {username.slice(0, 2)}
                </span>
                <span>
                  <span className="sr-only">Sesión iniciada como </span>
                  {username}
                </span>
              </span>
              <button type="button" onClick={cerrarSesion} disabled={saliendo} className="btn-secundario px-3 py-2">
                <Icono nombre="logout" />
                <span className="hidden sm:inline">{saliendo ? "Cerrando…" : "Cerrar sesión"}</span>
                <span className="sr-only sm:hidden">Cerrar sesión</span>
              </button>
            </div>
          </div>
        </header>
        <main id="contenido-admin" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-600 sm:px-6">
          Proyecto de Tesis UPN 2026 · Sistema Web de Comercio Electrónico Ferretero basado en Machine Learning · FerreMax
        </footer>
      </div>
    </div>
  );
}

function BarraLateral({ alNavegar }: { alNavegar?: () => void }) {
  const ruta = usePathname();
  const { config, conexion, username } = useAdmin();
  return (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-10 items-center justify-center rounded-lg bg-acento-700 text-lg font-black" aria-hidden="true">
          F
        </span>
        <div>
          <p className="text-lg font-black leading-none tracking-tight">
            FERRE<span className="text-acento-500">MAX</span>
          </p>
          <p className="mt-1 text-xs text-marca-200">Panel de control</p>
        </div>
      </div>
      <nav aria-label="Panel de administración" className="flex-1 overflow-y-auto px-3 pb-4">
        {GRUPOS.map((g) => (
          <div key={g.titulo} className="mt-4">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-marca-200">{g.titulo}</p>
            <ul className="mt-2 space-y-1">
              {g.enlaces.map((e) => {
                const activo = ruta === e.href || ruta.startsWith(`${e.href}/`);
                return (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      onClick={alNavegar}
                      aria-current={activo ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-white ${
                        activo ? "bg-acento-700 text-white" : "text-marca-50 hover:bg-white/10"
                      }`}
                    >
                      <Icono nombre={e.icono} />
                      <span className="flex-1">{e.texto}</span>
                      {activo && <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden="true" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-lg bg-white/10 p-3 text-xs text-marca-50">
        <p className="font-semibold">Servidor del panel</p>
        <p className="mt-1 flex items-center gap-1.5" aria-live="polite">
          <span
            className={`size-2 rounded-full ${conexion === "en-linea" ? "bg-emerald-400" : conexion === "sin-conexion" ? "bg-red-400" : "bg-slate-400"}`}
            aria-hidden="true"
          />
          {conexion === "en-linea" ? "En línea" : conexion === "sin-conexion" ? "Sin conexión" : "Comprobando…"}
        </p>
        <p className="mt-1">
          Modo activo: {config ? `${config.modo_activo} · ${config.modo_activo === "ML" ? "Machine Learning" : "Convencional"}` : "—"}
        </p>
        <p className="mt-1 md:hidden">Usuario: {username}</p>
        <p className="mt-2 text-marca-200">Tesis UPN 2026 · Recomendación</p>
      </div>
    </>
  );
}
