import Link from "next/link";
import { ORDEN_CATEGORIAS, urlBusqueda } from "@/lib/formato";
import { Icono } from "../icono";
import { Logo } from "./encabezado";
import { BannerDatos } from "./banner-datos";

const AYUDA = [
  { href: "/mi-cuenta", texto: "Seguimiento de pedidos" },
  { href: "/ayuda/envios", texto: "Políticas de envío" },
  { href: "/ayuda/faq", texto: "Preguntas frecuentes (FAQ)" },
  { href: "/ayuda/terminos", texto: "Términos y condiciones" },
  { href: "/ayuda/privacidad", texto: "Políticas de privacidad" },
];

export function Pie() {
  return (
    <footer className="mt-16 bg-marca-900 text-marca-100">
      <div className="contenedor grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 text-sm">
          <Logo claro />
          <p>Abastecimiento de herramientas, materiales de construcción y acabados para obras residenciales y proyectos en todo el Perú.</p>
          <p className="flex items-center gap-2">
            <Icono nombre="call" /> Central: (01) 712 3456
          </p>
          <p className="flex items-center gap-2">
            <Icono nombre="mail" /> contacto@ferremax.pe
          </p>
          <p className="flex items-center gap-2">
            <Icono nombre="schedule" /> Lun – Sáb: 7:00 am – 7:00 pm
          </p>
        </div>
        <div>
          <h2 className="mb-3 font-bold text-white">Categorías</h2>
          <ul className="space-y-2 text-sm">
            {ORDEN_CATEGORIAS.map((c) => (
              <li key={c}>
                <Link href={urlBusqueda({ categoria: c })} className="hover:text-white hover:underline">
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-bold text-white">Ayuda y soporte</h2>
          <ul className="space-y-2 text-sm">
            {AYUDA.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="hover:text-white hover:underline">
                  {a.texto}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/libro-reclamaciones" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-marca-600 px-3 py-2 text-sm font-semibold text-white hover:bg-marca-800">
            <Icono nombre="menu_book" /> Libro de Reclamaciones
          </Link>
        </div>
        <div>
          <h2 className="mb-3 font-bold text-white">Medios de pago</h2>
          <ul className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
            {["VISA", "Mastercard", "Yape", "Plin", "PagoEfectivo", "Efectivo"].map((m) => (
              <li key={m} className="rounded bg-white px-2 py-1.5 text-marca-900">
                {m}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs">Precios en soles con IGV incluido. Venta directa & mayorista con Boleta o Factura electrónica.</p>
        </div>
      </div>
      <div className="border-t border-marca-800 bg-marca-950">
        <p className="contenedor py-4 text-center text-xs">
          Tesis: Sistema web basado en Machine Learning para la recomendación de productos · UPN 2026 · © 2026 FerreMax · Lima, Perú
        </p>
      </div>
      <BannerDatos />
    </footer>
  );
}
