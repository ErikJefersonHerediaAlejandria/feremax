import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icono } from "@/components/icono";
import { ImagenProducto } from "@/components/imagen-producto";
import { TarjetaProducto } from "@/components/tarjeta-producto";
import { FichaCompra, PestanasProducto, RecomendacionesDetalle } from "@/components/tienda/detalle";
import { producto, productos } from "@/lib/api-servidor";
import { imagenProducto, precio, urlBusqueda } from "@/lib/formato";
import { SITIO } from "@/lib/sitio";

// Las fichas se prerenderizan completas (SEO y LCP): el contenido va en orden en el HTML en lugar de llegar por
// streaming detrás de un <Suspense>. Por eso la ruta lee params arriba y renuncia a la validación de navegación
// instantánea (la navegación al detalle espera al servidor; las 52 fichas ya están prerenderizadas).
export const instant = false;

export async function generateStaticParams() {
  const todos = await productos();
  return todos.length ? todos.map((p) => ({ sku: p.sku })) : [{ sku: "VAL-002" }];
}

export async function generateMetadata({ params }: PageProps<"/detalle/[sku]">): Promise<Metadata> {
  const { sku } = await params;
  const p = await producto(decodeURIComponent(sku));
  if (!p) return { title: "Producto no encontrado", robots: { index: false } };
  const descripcion = `${p.nombre} ${p.marca ? `de ${p.marca}` : ""} a ${precio(p.precio)} (IGV incluido). ${p.uso ?? ""}. ${p.categoria} · FerreMax, Lima.`.replace(/\s+/g, " ");
  return {
    title: p.nombre,
    description: descripcion,
    alternates: { canonical: `/detalle/${encodeURIComponent(p.sku)}` },
    openGraph: { title: p.nombre, description: descripcion, images: [{ url: imagenProducto(p.sku), alt: p.nombre }], type: "website" },
  };
}

export default async function PaginaDetalle({ params }: PageProps<"/detalle/[sku]">) {
  const sku = decodeURIComponent((await params).sku);
  const p = await producto(sku);
  if (!p) notFound();
  const deCategoria = p.categoria ? await productos(p.categoria) : [];
  const similares = deCategoria
    .filter((x) => x.sku !== p.sku)
    .sort((a, b) => Number(b.subcategoria === p.subcategoria) - Number(a.subcategoria === p.subcategoria))
    .slice(0, 4);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nombre,
    sku: p.sku,
    brand: p.marca ? { "@type": "Brand", name: p.marca } : undefined,
    category: [p.categoria, p.subcategoria].filter(Boolean).join(" > "),
    description: p.uso ?? undefined,
    image: `${SITIO}${imagenProducto(p.sku)}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "PEN",
      price: p.precio.toFixed(2),
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${SITIO}/detalle/${encodeURIComponent(p.sku)}`,
    },
  };

  return (
    <div className="contenedor py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Migas de pan" className="mb-4 text-sm text-slate-700">
        <Link href="/" className="hover:underline">
          Inicio
        </Link>{" "}
        ›{" "}
        {p.categoria && (
          <>
            <Link href={urlBusqueda({ categoria: p.categoria })} className="hover:underline">
              {p.categoria}
            </Link>{" "}
            ›{" "}
          </>
        )}
        {p.subcategoria && <>{p.subcategoria} › </>}
        <span className="font-semibold text-marca-900">{p.nombre}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="tarjeta relative p-4">
          {p.subcategoria && <span className="chip absolute left-4 top-4 z-10 bg-marca-900 text-white">{p.subcategoria}</span>}
          <ImagenProducto sku={p.sku} nombre={p.nombre} categoria={p.categoria} sizes="(min-width: 1024px) 600px, 100vw" prioridad />
        </div>
        <div>
          {p.marca && <span className="chip bg-marca-50 text-marca-800">{p.marca}</span>}
          <h1 className="mt-2 text-3xl font-extrabold text-marca-900">{p.nombre}</h1>
          <p className="mt-1 text-sm text-slate-700">
            SKU: {p.sku} · Categoría: {p.categoria}
          </p>
          <p className="mt-4 text-4xl font-extrabold text-marca-900">
            {precio(p.precio)} <span className="text-base font-medium text-slate-600">/ {p.unidad ?? "Und"} · IGV incluido</span>
          </p>
          <p className="mt-2">
            {p.stock > 0 ? (
              <span className="chip bg-emerald-50 text-emerald-800">
                <span className="size-2 animate-pulse rounded-full bg-emerald-600" /> En stock · {p.stock} {p.stock === 1 ? "unidad" : "unidades"}
              </span>
            ) : (
              <span className="chip bg-red-50 text-red-800">Sin stock</span>
            )}
          </p>
          <FichaCompra producto={p} />
          <ul className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            {[
              ["local_shipping", "Delivery en Lima Metropolitana", "Costo y fecha de despacho por coordinar al confirmar el pedido"],
              ["store", "Recojo en tienda sin costo", "Retira tu pedido en la tienda FerreMax"],
              ["credit_card", "Yape, Plin, Visa, Mastercard, PagoEfectivo o efectivo", "Emisión de Boleta o Factura electrónica"],
            ].map(([i, t, d]) => (
              <li key={t} className="flex gap-3">
                <Icono nombre={i} className="text-2xl text-acento-700" />
                <span>
                  <strong className="block text-marca-900">{t}</strong>
                  <span className="text-slate-700">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <PestanasProducto producto={p} />

      <div className="mt-10">
        <RecomendacionesDetalle sku={p.sku} />
      </div>

      {similares.length > 0 && (
        <section className="mt-10" aria-labelledby="similares">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 id="similares" className="text-xl font-extrabold text-marca-900">
              Productos similares
            </h2>
            <Link href={urlBusqueda({ categoria: p.categoria! })} className="text-sm font-semibold text-acento-800 hover:underline">
              Ver categoría {p.categoria} <Icono nombre="arrow_forward" />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {similares.map((s) => (
              <li key={s.sku}>
                <TarjetaProducto producto={s} origen="CATEGORIA" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
