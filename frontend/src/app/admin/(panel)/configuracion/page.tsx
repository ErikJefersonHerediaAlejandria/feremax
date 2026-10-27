import type { Metadata } from "next";
import { VistaConfiguracion } from "@/components/admin/configuracion";

export const metadata: Metadata = { title: "Configuración" };

export default function Pagina() {
  return <VistaConfiguracion />;
}

// Contenido protegido: el guard del panel no lo renderiza hasta verificar la cookie del admin, así que no hay
// App Shell que validar para navegación instantánea.
export const instant = false;
