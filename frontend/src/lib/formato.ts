export const precio = (x: number | null | undefined) => `S/ ${Number(x ?? 0).toFixed(2)}`;

export const numeroPedido = (id: number) => String(id).padStart(6, "0");

export const plural = (n: number, singular: string, pluralForma = `${singular}s`) => `${n} ${n === 1 ? singular : pluralForma}`;

export const imagenProducto = (sku: string) => `/img/productos/${encodeURIComponent(sku)}.webp`;

export const ICONO_CATEGORIA: Record<string, string> = {
  "Pinturas y Acabados": "format_paint",
  Herramientas: "handyman",
  "Construcción y Estructuras": "foundation",
  Electricidad: "electrical_services",
  Gasfitería: "plumbing",
  "Ferretería General": "hardware",
};

export const IMAGEN_CATEGORIA: Record<string, string> = {
  "Pinturas y Acabados": "/img/categorias/pinturas-y-acabados.webp",
  Herramientas: "/img/categorias/herramientas.webp",
  "Construcción y Estructuras": "/img/categorias/construccion-y-estructuras.webp",
  Electricidad: "/img/categorias/electricidad.webp",
  Gasfitería: "/img/categorias/gasfiteria.webp",
  "Ferretería General": "/img/categorias/ferreteria-general.webp",
};

/** Orden de las categorías en la tienda (el mismo de v1). */
export const ORDEN_CATEGORIAS = Object.keys(ICONO_CATEGORIA);

export const urlBusqueda = (p: { q?: string; categoria?: string }) => {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.categoria) s.set("categoria", p.categoria);
  return `/busqueda?${s.toString()}`;
};

export const urlDetalle = (sku: string, origen?: string, pos?: number | null) => {
  const s = new URLSearchParams();
  if (origen) s.set("origen", origen);
  if (pos) s.set("pos", String(pos));
  const q = s.toString();
  return `/detalle/${encodeURIComponent(sku)}${q ? `?${q}` : ""}`;
};

export const fechaHora = (iso: string | Date) =>
  new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(iso));
