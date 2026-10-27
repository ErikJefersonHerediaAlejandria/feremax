import type { MetadataRoute } from "next";
import { SITIO } from "@/lib/sitio";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/carrito", "/confirmar", "/pedido-registrado", "/mi-cuenta", "/login"] },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
