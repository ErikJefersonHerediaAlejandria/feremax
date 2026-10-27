import type { Metadata } from "next";
import { VistaResumen } from "@/components/admin/resumen";

export const metadata: Metadata = { title: "Resumen" };

export default function Pagina() {
  return <VistaResumen />;
}

// Contenido protegido: el guard del panel no lo renderiza hasta verificar la cookie del admin, así que no hay
// App Shell que validar para navegación instantánea.
export const instant = false;
