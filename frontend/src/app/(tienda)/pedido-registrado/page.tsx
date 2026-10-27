import type { Metadata } from "next";
import { PedidoRegistradoVista } from "@/components/tienda/cuenta";

export const metadata: Metadata = { title: "Pedido registrado", robots: { index: false } };

export default function PaginaPedidoRegistrado() {
  return (
    <div className="contenedor py-8">
      <PedidoRegistradoVista />
    </div>
  );
}
