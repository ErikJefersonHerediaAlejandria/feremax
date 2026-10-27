import type { Metadata } from "next";
import { LoginCliente } from "@/components/tienda/cuenta";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false } };

export default function PaginaLogin() {
  return (
    <div className="contenedor py-6">
      <LoginCliente />
    </div>
  );
}
