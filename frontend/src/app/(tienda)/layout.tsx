import { Suspense } from "react";
import { Aviso, Encabezado } from "@/components/tienda/encabezado";
import { Pie } from "@/components/tienda/pie";

export default function LayoutTienda({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2">
        Saltar al contenido
      </a>
      <Encabezado />
      <main id="contenido" className="flex-1">
        <Suspense>{children}</Suspense>
      </main>
      <Pie />
      <Aviso />
    </>
  );
}
