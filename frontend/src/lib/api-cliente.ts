// Llamadas al API desde el navegador. Envía el token de la sesión experimental (x-sesion-evaluacion) y la cookie
// httpOnly del admin (credentials: "include"). Si NEXT_PUBLIC_API_URL está vacío, usa /api del mismo origen (proxy).
import type { ProductoPuntuado } from "./tipos";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const CLAVE_SESION = "ferremax_sesion_eval";

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export function tokenSesion(): string | null {
  try {
    const v = localStorage.getItem(CLAVE_SESION);
    return v ? (JSON.parse(v) as { token?: string }).token ?? null : null;
  } catch {
    return null;
  }
}

export async function api<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown; senal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opciones.cuerpo !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenSesion();
  if (token) headers["x-sesion-evaluacion"] = token;
  const res = await fetch(`${API_URL}${ruta}`, {
    method: opciones.metodo ?? (opciones.cuerpo === undefined ? "GET" : "POST"),
    headers,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    credentials: "include",
    signal: opciones.senal,
    cache: "no-store",
  });
  const texto = await res.text();
  const datos = texto ? (JSON.parse(texto) as unknown) : null;
  if (!res.ok) {
    const detalle = (datos as { detail?: unknown } | null)?.detail;
    throw new ErrorApi(res.status, typeof detalle === "string" ? detalle : `Error ${res.status}`);
  }
  return datos as T;
}

export const recomendaciones = {
  porProducto: (sku: string, k = 5, senal?: AbortSignal) =>
    api<ProductoPuntuado[]>(`/api/recomendar?sku=${encodeURIComponent(sku)}&k=${k}`, { senal }),
  porCarrito: (skus: string[], k = 5, senal?: AbortSignal) =>
    api<ProductoPuntuado[]>("/api/recomendar/carrito", { cuerpo: { skus, k }, senal }),
  porCliente: (codigo: string, skus: string[], k = 5, senal?: AbortSignal) => {
    const q = new URLSearchParams(skus.map((s) => ["skus", s]));
    q.set("k", String(k));
    return api<{ base: string; resultados: ProductoPuntuado[] }>(`/api/recomendar/cliente/${encodeURIComponent(codigo)}?${q}`, { senal }).then(
      (r) => r.resultados,
    );
  },
};
