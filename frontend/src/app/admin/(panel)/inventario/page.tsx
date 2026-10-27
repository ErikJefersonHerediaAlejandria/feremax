import type { Metadata } from "next";
import { VistaInventario } from "@/components/admin/inventario";

export const metadata: Metadata = { title: "Productos e inventario" };

export default function Pagina() {
  return <VistaInventario />;
}

// Contenido protegido: el guard del panel no lo renderiza hasta verificar la cookie del admin, así que no hay
// App Shell que validar para navegación instantánea.
export const instant = false;
