"use client";

import { useTienda } from "@/contexto/tienda";
import { Icono } from "../icono";

/** Aviso permanente del origen de los datos (como en v1). */
export function BannerDatos() {
  const { config } = useTienda();
  const reales = config?.fuente_datos === "empresa";
  return (
    <p className="bg-marca-950 px-4 py-2 text-center text-xs text-marca-100">
      <Icono nombre={reales ? "verified" : "science"} /> <strong className="text-white">{reales ? "Datos reales anonimizados" : "Datos simulados"}</strong>
      {reales
        ? " · Prototipo de tesis UPN 2026 · ventas de la empresa; clientes identificados solo por código anónimo"
        : " · Prototipo de tesis UPN 2026 · los productos, ventas y clientes no son reales"}
    </p>
  );
}
