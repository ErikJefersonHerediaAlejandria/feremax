import type { MetadataRoute } from "next";
import { categorias, productos } from "@/lib/api-servidor";
import { SITIO } from "@/lib/sitio";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [todos, cats] = await Promise.all([productos(), categorias()]);
  const fijas = ["", "/busqueda", "/ayuda/faq", "/ayuda/envios", "/ayuda/privacidad", "/ayuda/terminos", "/libro-reclamaciones"];
  return [
    ...fijas.map((r) => ({ url: `${SITIO}${r}`, changeFrequency: "weekly" as const, priority: r === "" ? 1 : 0.5 })),
    ...cats.map((c) => ({ url: `${SITIO}/busqueda?categoria=${encodeURIComponent(c.categoria)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...todos.map((p) => ({ url: `${SITIO}/detalle/${encodeURIComponent(p.sku)}`, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
