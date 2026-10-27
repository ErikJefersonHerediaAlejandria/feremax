import type { Producto } from '../generated/prisma/client.js';

/** Forma `ProductoResponse` del API v1 (sin campos internos como `activo` o `imagen_url`). */
export function productoV1(p: Producto) {
  return {
    sku: p.sku,
    nombre: p.nombre,
    marca: p.marca,
    categoria: p.categoria,
    subcategoria: p.subcategoria,
    unidad: p.unidad,
    uso: p.uso,
    precio: Number(p.precio),
    stock: p.stock,
  };
}

export const redondear = (x: number, d = 2) =>
  Math.round(x * 10 ** d) / 10 ** d;
