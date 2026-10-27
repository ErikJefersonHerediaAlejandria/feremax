"use client";

import { useTienda } from "@/contexto/tienda";
import { Recomendaciones } from "./recomendaciones";

export function RecomendadosInicio() {
  const { carrito } = useTienda();
  return (
    <Recomendaciones
      contexto="inicio"
      skus={carrito.map((i) => i.sku)}
      titulo="Recomendados para ti"
      subtitulo={carrito.length ? "Según los productos de tu carrito" : "Según los productos más comprados"}
    />
  );
}
