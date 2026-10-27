"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Icono } from "@/components/icono";
import { api, ErrorApi } from "@/lib/api-cliente";
import { mensajeError } from "./contexto";
import { Alerta } from "./ui";

/** Solo se aceptan destinos internos del panel (evita redirecciones abiertas). */
function destino(siguiente: string | null) {
  return siguiente && siguiente.startsWith("/admin") && !siguiente.startsWith("/admin/login") ? siguiente : "/admin/resumen";
}

export function FormularioLogin() {
  const router = useRouter();
  const siguiente = destino(useSearchParams().get("siguiente"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si la cookie de admin sigue vigente, no hace falta volver a ingresar.
  useEffect(() => {
    const c = new AbortController();
    api<{ valido: boolean }>("/api/admin/verificar", { senal: c.signal })
      .then((r) => {
        if (r.valido) router.replace(siguiente);
      })
      .catch(() => undefined);
    return () => c.abort();
  }, [router, siguiente]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api("/api/admin/login", { cuerpo: { username: username.trim(), password } });
      router.replace(siguiente);
    } catch (err) {
      setError(
        err instanceof ErrorApi && err.estado === 401
          ? "Usuario o contraseña incorrectos."
          : err instanceof ErrorApi && err.estado === 429
            ? "Demasiados intentos. Espere un minuto y vuelva a intentarlo."
            : `No se pudo iniciar sesión: ${mensajeError(err)}`,
      );
      setEnviando(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-marca-50 px-4 py-10">
      <div className="tarjeta w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-acento-700 text-2xl font-black text-white" aria-hidden="true">
            F
          </span>
          <p className="mt-3 text-2xl font-black tracking-tight text-marca-900">
            FERRE<span className="text-acento-700">MAX</span>
          </p>
          <h1 className="mt-1 text-sm font-medium text-slate-600">Panel de administración</h1>
        </div>
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label htmlFor="usuario" className="mb-1 block text-sm font-medium text-slate-800">
              Usuario
            </label>
            <input id="usuario" className="campo" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label htmlFor="clave" className="mb-1 block text-sm font-medium text-slate-800">
              Contraseña
            </label>
            <input id="clave" type="password" className="campo" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div aria-live="assertive">{error && <Alerta tipo="error">{error}</Alerta>}</div>
          <button type="submit" className="btn-marca w-full" disabled={enviando}>
            <Icono nombre={enviando ? "progress_activity" : "login"} className={enviando ? "animate-spin" : ""} />
            {enviando ? "Ingresando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="font-medium text-marca-600 underline-offset-2 hover:underline">
            Volver a la tienda
          </Link>
        </p>
      </div>
    </main>
  );
}
