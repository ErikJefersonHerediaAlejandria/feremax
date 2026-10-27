import type { Metadata } from "next";
import { FormularioReclamo } from "@/components/tienda/reclamo";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones",
  description: "Libro de Reclamaciones virtual de FerreMax (prototipo de tesis: el formulario no envía datos).",
};

export default function LibroReclamaciones() {
  return (
    <div className="contenedor py-8">
      <article className="tarjeta mx-auto max-w-3xl p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold text-marca-900">Libro de Reclamaciones</h1>
        <p className="mt-1 text-slate-700">
          Conforme al Código de Protección y Defensa del Consumidor (Ley N.° 29571). Este es un prototipo de tesis: el formulario es una demostración y no envía ni
          guarda datos personales.
        </p>
        <FormularioReclamo />
      </article>
    </div>
  );
}
