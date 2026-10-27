"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ErrorApi } from "@/lib/api-cliente";
import type { ConfigAdmin } from "./tipos";

type Opciones = { metodo?: string; cuerpo?: unknown; senal?: AbortSignal };

export type EstadoConexion = "verificando" | "en-linea" | "sin-conexion";

interface Admin {
  username: string;
  /** Llama al API; ante un 401 redirige al login (con `siguiente`) y vuelve a lanzar el error. */
  llamar: <T>(ruta: string, opciones?: Opciones) => Promise<T>;
  config: ConfigAdmin | null;
  conexion: EstadoConexion;
  setConfig: (c: ConfigAdmin) => void;
  recargarConfig: () => void;
}

const Contexto = createContext<Admin | null>(null);

export function useAdmin() {
  const a = useContext(Contexto);
  if (!a) throw new Error("useAdmin debe usarse dentro del panel de administración");
  return a;
}

export const urlLogin = (siguiente: string) => `/admin/login?siguiente=${encodeURIComponent(siguiente)}`;

/** Mensaje legible de un error de fetch/API. */
export function mensajeError(e: unknown) {
  if (e instanceof ErrorApi) return e.message;
  if (e instanceof TypeError) return "no hay conexión con el servidor";
  if (e instanceof Error) return e.message;
  return String(e);
}

export function ProveedorAdmin({ username, children }: { username: string; children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const rutaRef = useRef(ruta);
  useEffect(() => {
    rutaRef.current = ruta;
  });
  const [config, setConfig] = useState<ConfigAdmin | null>(null);
  const [conexion, setConexion] = useState<EstadoConexion>("verificando");
  const [version, setVersion] = useState(0);

  const llamar = useCallback(
    async <T,>(r: string, opciones?: Opciones): Promise<T> => {
      try {
        return await api<T>(r, opciones);
      } catch (e) {
        if (e instanceof ErrorApi && e.estado === 401) router.replace(urlLogin(rutaRef.current));
        throw e;
      }
    },
    [router],
  );

  useEffect(() => {
    const c = new AbortController();
    llamar<ConfigAdmin>("/api/admin/config", { senal: c.signal }).then(
      (cfg) => {
        setConfig(cfg);
        setConexion("en-linea");
      },
      () => {
        if (!c.signal.aborted) setConexion("sin-conexion");
      },
    );
    return () => c.abort();
  }, [llamar, version]);

  const recargarConfig = useCallback(() => setVersion((v) => v + 1), []);
  const fijarConfig = useCallback((c: ConfigAdmin) => {
    setConfig(c);
    setConexion("en-linea");
  }, []);

  return (
    <Contexto.Provider value={{ username, llamar, config, conexion, setConfig: fijarConfig, recargarConfig }}>{children}</Contexto.Provider>
  );
}

/** Carga una ruta del API al montar (y al llamar a `recargar`), con estados de carga y error. */
export function useDatos<T>(ruta: string) {
  const { llamar } = useAdmin();
  const [estado, setEstado] = useState<{ datos?: T; error?: string; cargando: boolean }>({ cargando: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    llamar<T>(ruta, { senal: c.signal }).then(
      (datos) => setEstado({ datos, cargando: false }),
      (e) => {
        if (!c.signal.aborted) setEstado({ error: mensajeError(e), cargando: false });
      },
    );
    return () => c.abort();
  }, [llamar, ruta, version]);
  const recargar = useCallback(() => {
    setEstado((s) => ({ ...s, cargando: true }));
    setVersion((v) => v + 1);
  }, []);
  const setDatos = useCallback((datos: T) => setEstado({ datos, cargando: false }), []);
  return { ...estado, recargar, setDatos };
}
