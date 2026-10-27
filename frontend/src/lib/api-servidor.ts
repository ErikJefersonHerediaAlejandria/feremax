// Lecturas del catálogo en el servidor (Server Components): cacheadas con el perfil "catalogo" (next.config.ts).
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Categoria, Producto, ProductoPuntuado } from "./tipos";

const API = (process.env.API_URL_INTERNA ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

async function obtener<T>(ruta: string): Promise<T> {
  const res = await fetch(`${API}${ruta}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${ruta}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function productos(categoria?: string): Promise<Producto[]> {
  "use cache";
  cacheLife("catalogo");
  cacheTag("catalogo");
  return obtener<Producto[]>(`/api/productos${categoria ? `?categoria=${encodeURIComponent(categoria)}` : ""}`);
}

export async function categorias(): Promise<Categoria[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogo");
  return obtener<Categoria[]>("/api/categorias");
}

/** Producto por SKU, o null si no existe (404). */
export async function producto(sku: string): Promise<Producto | null> {
  "use cache";
  cacheLife("catalogo");
  cacheTag("catalogo", `producto-${sku}`);
  const res = await fetch(`${API}/api/productos/${encodeURIComponent(sku)}`, { headers: { Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API producto ${sku}: HTTP ${res.status}`);
  return (await res.json()) as Producto;
}

/** Búsqueda por necesidad (TF-IDF con sinónimos en el recommender), cacheada por texto. */
export async function buscarNecesidad(texto: string): Promise<ProductoPuntuado[]> {
  "use cache";
  cacheLife("catalogo");
  cacheTag("catalogo");
  const res = await fetch(`${API}/api/buscar-necesidad`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ texto, k: 24 }),
  });
  if (!res.ok) throw new Error(`API buscar-necesidad: HTTP ${res.status}`);
  return (await res.json()) as ProductoPuntuado[];
}
