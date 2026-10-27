import Image from "next/image";
import Link from "next/link";
import { Icono } from "@/components/icono";
import { TarjetaProducto } from "@/components/tarjeta-producto";
import { BusquedasFrecuentes } from "@/components/tienda/busquedas-frecuentes";
import { BuscadorNecesidad } from "@/components/tienda/encabezado";
import { RecomendadosInicio } from "@/components/tienda/recomendados-inicio";
import { categorias, productos } from "@/lib/api-servidor";
import { ICONO_CATEGORIA, IMAGEN_CATEGORIA, ORDEN_CATEGORIAS, urlBusqueda } from "@/lib/formato";

export default async function Inicio() {
  const [cats, todos] = await Promise.all([categorias(), productos()]);
  const ordenadas = [...cats].sort((a, b) => ORDEN_CATEGORIAS.indexOf(a.categoria) - ORDEN_CATEGORIAS.indexOf(b.categoria));
  const destacados = todos.slice(0, 8);

  return (
    <>
      <section className="relative overflow-hidden bg-marca-900 text-white">
        <div className="contenedor grid items-center gap-8 py-12 md:grid-cols-2 md:py-16">
          <div className="relative z-10">
            <p className="chip mb-4 bg-acento-500/20 text-acento-100">
              <Icono nombre="store" /> VENTA DIRECTA & MAYORISTA
            </p>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
              Todo para <span className="text-acento-500">construir y renovar</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-marca-100">Compra productos de ferretería de forma rápida y segura. Precios en soles con IGV incluido.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="#destacados" className="btn-primario px-6 py-3 text-base">
                Ver productos <Icono nombre="arrow_forward" />
              </Link>
              <Link href="/busqueda" className="btn border border-marca-200 px-6 py-3 text-base text-white hover:bg-marca-800">
                Todo el catálogo
              </Link>
            </div>
            <ul className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
              {[
                ["verified_user", "Compra segura", "Tus pagos protegidos"],
                ["local_shipping", "Envíos rápidos", "Delivery en Lima"],
                ["thumb_up", "Productos de calidad", "Garantía asegurada"],
              ].map(([i, t, d]) => (
                <li key={t} className="flex items-start gap-2">
                  <Icono nombre={i} className="text-2xl text-acento-500" />
                  <span>
                    <strong className="block">{t}</strong>
                    <span className="text-marca-100">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative hidden aspect-[4/3] overflow-hidden rounded-2xl md:block">
            <Image
              src="/img/categorias/portada-1.webp"
              alt="Herramientas profesionales y materiales de construcción sobre mesa de trabajo"
              fill
              sizes="(min-width: 768px) 50vw, 0px"
              className="object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      <div className="contenedor -mt-6 relative z-10">
        <section className="tarjeta p-5 sm:p-6" aria-labelledby="necesidad-titulo">
          <h2 id="necesidad-titulo" className="flex items-center gap-2 text-xl font-extrabold text-marca-900">
            <Icono nombre="lightbulb" className="text-acento-700" /> ¿Qué necesitas hacer hoy?
          </h2>
          <p className="mb-4 text-sm text-slate-700">Describe tu proyecto o reparación para encontrar al instante los materiales y herramientas que necesitas.</p>
          <BuscadorNecesidad grande />
          <div className="mt-4">
            <BusquedasFrecuentes />
          </div>
        </section>
      </div>

      <section id="categorias" className="contenedor mt-14 scroll-mt-24" aria-labelledby="categorias-titulo">
        <h2 id="categorias-titulo" className="text-2xl font-extrabold text-marca-900">
          Categorías principales
        </h2>
        <p className="mb-6 text-slate-700">Explora los rubros de nuestro catálogo para proyectos residenciales e industriales · {todos.length} productos en {cats.length} categorías</p>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {ordenadas.map((c) => (
            <li key={c.categoria}>
              <Link href={urlBusqueda({ categoria: c.categoria })} className="tarjeta group block overflow-hidden hover:shadow-md">
                <div className="relative aspect-[16/9] bg-marca-50">
                  {IMAGEN_CATEGORIA[c.categoria] ? (
                    <Image src={IMAGEN_CATEGORIA[c.categoria]} alt="" fill sizes="(min-width: 768px) 33vw, 50vw" className="object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <Icono nombre={ICONO_CATEGORIA[c.categoria] ?? "category"} className="m-auto text-5xl text-marca-200" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="flex items-center gap-2 font-bold text-marca-900">
                    <Icono nombre={ICONO_CATEGORIA[c.categoria] ?? "category"} className="text-acento-700" /> {c.categoria}
                  </h3>
                  <p className="mt-1 text-sm text-slate-700">{c.subcategorias.join(", ")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="destacados" className="contenedor mt-14 scroll-mt-24" aria-labelledby="destacados-titulo">
        <h2 id="destacados-titulo" className="text-2xl font-extrabold text-marca-900">
          Productos destacados
        </h2>
        <p className="mb-6 text-slate-700">Los productos más vendidos de nuestro catálogo</p>
        {destacados.length === 0 ? (
          <p className="tarjeta p-8 text-center text-slate-700">No hay productos disponibles en este momento.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {destacados.map((p) => (
              <li key={p.sku}>
                <TarjetaProducto producto={p} origen="CATEGORIA">
                  <span className="chip w-fit bg-marca-50 text-marca-800">{p.subcategoria ?? p.categoria}</span>
                </TarjetaProducto>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="contenedor mt-14">
        <RecomendadosInicio />
      </div>
    </>
  );
}
