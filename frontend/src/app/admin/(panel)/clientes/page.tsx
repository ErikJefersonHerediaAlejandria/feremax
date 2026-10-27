import type { Metadata } from "next";
import { VistaClientes } from "@/components/admin/clientes";

export const metadata: Metadata = { title: "Clientes" };

export default function Pagina() {
  return <VistaClientes />;
}

// Contenido protegido: el guard del panel no lo renderiza hasta verificar la cookie del admin, así que no hay
// App Shell que validar para navegación instantánea.
export const instant = false;
