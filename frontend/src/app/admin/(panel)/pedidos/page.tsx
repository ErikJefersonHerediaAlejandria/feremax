import type { Metadata } from "next";
import { VistaPedidos } from "@/components/admin/pedidos";

export const metadata: Metadata = { title: "Pedidos" };

export default function Pagina() {
  return <VistaPedidos />;
}

// Contenido protegido: el guard del panel no lo renderiza hasta verificar la cookie del admin, así que no hay
// App Shell que validar para navegación instantánea.
export const instant = false;
