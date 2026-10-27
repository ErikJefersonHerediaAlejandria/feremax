import type { NextConfig } from "next";

// Proxy opcional de /api/* hacia el backend (útil cuando frontend y API no comparten dominio,
// p. ej. en las URL provisionales *.vercel.app / *.onrender.com, para que la cookie del admin sea same-site).
const proxy = process.env.API_PROXY_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Catálogo: el servidor lo revalida cada minuto (precio y stock cambian con las ventas). `stale` de 5 min es el
  // mínimo para que entre en el App Shell (ver cacheLife > Prerendering behavior); el stock real lo valida el backend.
  cacheLife: {
    catalogo: { stale: 300, revalidate: 60, expire: 3600 },
  },
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return proxy ? [{ source: "/api/:path*", destination: `${proxy}/api/:path*` }] : [];
  },
};

export default nextConfig;
