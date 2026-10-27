import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icono } from "@/components/icono";
import { VistaResultados } from "@/components/tienda/vista-resultados";
import { buscarNecesidad, productos } from "@/lib/api-servidor";

export const metadata: Metadata = {
  title: "Buscar productos",
  description: "Busca por necesidad (por ejemplo «pintar una pared») o explora el catálogo de FerreMax por categoría.",
};

const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

async function Resultados({ searchParams }: Pick<PageProps<"/busqueda">, "searchParams">) {
  const sp = await searchParams;
  const q = texto(sp.q);
  const categoria = texto(sp.categoria);
  const modo = q ? "necesidad" : categoria ? "categoria" : "todos";
  const termino = q || categoria;
  let resultados;
  try {
    resultados = q ? await buscarNecesidad(q) : await productos(categoria || undefined);
  } catch {
    resultados = null;
  }
  if (!resultados) {
    return (
      <p className="tarjeta mt-6 p-8 text-center text-red-800" role="alert">
        No se pudo consultar el catálogo. Intenta nuevamente.
      </p>
    );
  }
  return <VistaResultados key={`${modo}:${termino}`} modo={modo} termino={termino} resultados={resultados} />;
}

export default function Busqueda({ searchParams }: PageProps<"/busqueda">) {
  return (
    <div className="contenedor py-6">
      <nav aria-label="Migas de pan" className="mb-4 text-sm text-slate-700">
        <Link href="/" className="hover:underline">
          <Icono nombre="home" /> Inicio
        </Link>{" "}
        › <span className="font-semibold text-marca-900">Productos</span>
      </nav>
      <Suspense fallback={<p className="tarjeta p-8 text-center text-slate-700" role="status">Cargando resultados…</p>}>
        <Resultados searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
