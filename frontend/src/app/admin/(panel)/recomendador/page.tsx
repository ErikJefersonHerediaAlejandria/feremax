import type { Metadata } from "next";
import { VistaRecomendador } from "@/components/admin/recomendador";

export const metadata: Metadata = { title: "Recomendador" };

export default function Pagina() {
  return <VistaRecomendador />;
}

// Contenido protegido: el guard del panel no lo renderiza hasta verificar la cookie del admin, así que no hay
// App Shell que validar para navegación instantánea.
export const instant = false;
