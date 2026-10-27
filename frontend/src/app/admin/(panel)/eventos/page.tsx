import type { Metadata } from "next";
import { VistaEventos } from "@/components/admin/eventos";

export const metadata: Metadata = { title: "Registro de eventos" };

export default function Pagina() {
  return <VistaEventos />;
}

// Contenido protegido: el guard del panel no lo renderiza hasta verificar la cookie del admin, así que no hay
// App Shell que validar para navegación instantánea.
export const instant = false;
