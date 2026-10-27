"use client";

import Image from "next/image";
import { useState } from "react";
import { ICONO_CATEGORIA, imagenProducto } from "@/lib/formato";
import { Icono } from "./icono";

/** Foto del producto (/img/productos/{sku}.webp); si falla, el ícono de su categoría. */
export function ImagenProducto({
  sku,
  nombre,
  categoria,
  sizes = "(min-width: 1024px) 220px, (min-width: 640px) 33vw, 50vw",
  prioridad = false,
  className = "",
}: {
  sku: string;
  nombre: string;
  categoria: string | null;
  sizes?: string;
  prioridad?: boolean;
  className?: string;
}) {
  const [error, setError] = useState(false);
  return (
    <div className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white ${className}`}>
      {error ? (
        <Icono nombre={ICONO_CATEGORIA[categoria ?? ""] ?? "inventory_2"} className="text-5xl text-marca-200" />
      ) : (
        <Image
          src={imagenProducto(sku)}
          alt={nombre}
          fill
          sizes={sizes}
          className="object-contain p-3 mix-blend-multiply"
          // Imagen principal (LCP): <link rel="preload"> en el <head> para pedirla antes que los scripts.
          preload={prioridad}
          loading={prioridad ? undefined : "lazy"}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}
