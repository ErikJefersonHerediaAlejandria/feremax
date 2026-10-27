import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioLogin } from "@/components/admin/login";

export const metadata: Metadata = { title: "Ingresar" };

export default function PaginaLogin() {
  // useSearchParams (?siguiente=) requiere un límite de Suspense.
  return (
    <Suspense>
      <FormularioLogin />
    </Suspense>
  );
}
