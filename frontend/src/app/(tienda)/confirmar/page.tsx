import type { Metadata } from "next";
import Link from "next/link";
import { Confirmar } from "@/components/tienda/confirmar";

export const metadata: Metadata = { title: "Confirmar pedido", robots: { index: false } };

export default function PaginaConfirmar() {
  return (
    <div className="contenedor py-6">
      <nav aria-label="Migas de pan" className="mb-4 text-sm text-slate-700">
        <Link href="/" className="hover:underline">Inicio</Link> › <Link href="/carrito" className="hover:underline">Carrito de compras</Link> ›{" "}
        <span className="font-semibold text-marca-900">Confirmar pedido</span>
      </nav>
      <h1 className="text-3xl font-extrabold text-marca-900">Confirmar pedido</h1>
      <p className="mb-6 text-slate-700">Elige la modalidad de entrega y el medio de pago de tu pedido.</p>
      <Confirmar />
    </div>
  );
}
