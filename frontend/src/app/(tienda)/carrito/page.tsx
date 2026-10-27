import type { Metadata } from "next";
import Link from "next/link";
import { Carrito } from "@/components/tienda/carrito";

export const metadata: Metadata = { title: "Carrito de compras", robots: { index: false } };

export default function PaginaCarrito() {
  return (
    <div className="contenedor py-6">
      <nav aria-label="Migas de pan" className="mb-4 text-sm text-slate-700">
        <Link href="/" className="hover:underline">Inicio</Link> › <span className="font-semibold text-marca-900">Carrito de compras</span>
      </nav>
      <Carrito />
    </div>
  );
}
