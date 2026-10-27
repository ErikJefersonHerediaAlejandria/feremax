import Link from "next/link";
import { Icono } from "@/components/icono";

export default function NoEncontrado() {
  return (
    <div className="contenedor py-16">
      <div className="tarjeta mx-auto max-w-lg p-10 text-center">
        <Icono nombre="search_off" className="text-5xl text-slate-500" />
        <h1 className="mt-2 text-2xl font-extrabold text-marca-900">Página no encontrada</h1>
        <p className="text-slate-700">El producto o la página que buscas no existe.</p>
        <Link href="/" className="btn-primario mt-5">
          <Icono nombre="arrow_back" /> Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
