import type { Metadata } from "next";
import { MiCuenta } from "@/components/tienda/cuenta";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

export default function PaginaMiCuenta() {
  return (
    <div className="contenedor py-6">
      <MiCuenta />
    </div>
  );
}
