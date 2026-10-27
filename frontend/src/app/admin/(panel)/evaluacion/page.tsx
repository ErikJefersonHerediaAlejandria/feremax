import type { Metadata } from "next";
import { VistaEvaluacion } from "@/components/admin/evaluacion";

export const metadata: Metadata = { title: "Evaluación" };

export default function Pagina() {
  return <VistaEvaluacion />;
}

// Contenido protegido: el guard del panel no lo renderiza hasta verificar la cookie del admin, así que no hay
// App Shell que validar para navegación instantánea.
export const instant = false;
