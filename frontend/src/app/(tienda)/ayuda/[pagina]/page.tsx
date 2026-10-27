import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

// Textos propios de un prototipo de tesis (v1 tenía estos enlaces sin contenido; ver DECISIONES D-09).
const PAGINAS: Record<string, { titulo: string; descripcion: string; secciones: [string, string][] }> = {
  faq: {
    titulo: "Preguntas frecuentes",
    descripcion: "Respuestas sobre compras, pagos, entregas y el prototipo de tesis FerreMax.",
    secciones: [
      ["¿Qué es esta tienda?", "FerreMax es un prototipo de tesis (UPN 2026) que compara dos formas de recomendar productos en una ferretería en línea. Los productos, precios y pedidos se usan solo con fines académicos."],
      ["¿Los precios incluyen IGV?", "Sí. Todos los precios están en soles e incluyen IGV."],
      ["¿Cómo busco lo que necesito?", "Escribe tu necesidad en el buscador, por ejemplo «pintar una pared» o «reparar una fuga», o explora el catálogo por categoría."],
      ["¿Cómo se guarda mi carrito?", "Tu carrito se conserva en este navegador; no necesitas una cuenta."],
      ["¿Qué medios de pago aceptan?", "Yape, Plin, Visa, Mastercard, PagoEfectivo y efectivo. En el prototipo el pago es simulado: no se realiza ningún cobro."],
      ["¿Necesito registrarme?", "No. Cada participante se identifica con un código anónimo; el registro de clientes está deshabilitado en el prototipo."],
    ],
  },
  envios: {
    titulo: "Políticas de envío",
    descripcion: "Delivery en Lima Metropolitana y recojo en tienda sin costo.",
    secciones: [
      ["Recojo en tienda", "Sin costo. Presenta tu número de pedido en la tienda FerreMax, de lunes a sábado de 7:00 am a 7:00 pm."],
      ["Delivery en Lima Metropolitana", "Entrega en obra o domicilio. La fecha y el costo del envío se coordinan después de registrar el pedido y no se incluyen en el total mostrado."],
      ["Pedidos mayoristas", "Para compras por volumen (cemento, fierro, tuberías) coordinamos el despacho con tu obra. Central: (01) 712 3456."],
    ],
  },
  privacidad: {
    titulo: "Políticas de privacidad",
    descripcion: "Qué datos registra el prototipo y cómo se usan.",
    secciones: [
      ["Datos que registramos", "Solo un código de cliente anónimo y la interacción con la tienda (búsquedas, productos vistos, recomendaciones mostradas, productos agregados y pedidos). No se solicitan nombres, documentos, teléfonos ni correos."],
      ["Finalidad", "Medir, con fines de investigación, la utilidad de dos métodos de recomendación de productos."],
      ["Historial de compras", "El historial asociado a un código solo se usa para recomendar durante la sesión de evaluación de ese mismo participante, y nunca se muestra en la tienda."],
      ["Contacto", "contacto@ferremax.pe"],
    ],
  },
  terminos: {
    titulo: "Términos y condiciones",
    descripcion: "Condiciones de uso del prototipo FerreMax.",
    secciones: [
      ["Naturaleza del sitio", "Prototipo académico: los pedidos no generan cobros ni entregas reales."],
      ["Precios y stock", "Los precios están en soles con IGV. El stock se valida al confirmar el pedido."],
      ["Comprobantes", "En una operación real se emitiría Boleta o Factura electrónica."],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGINAS).map((pagina) => ({ pagina }));
}

export async function generateMetadata({ params }: PageProps<"/ayuda/[pagina]">): Promise<Metadata> {
  const p = PAGINAS[(await params).pagina];
  return p ? { title: p.titulo, description: p.descripcion } : { title: "Ayuda" };
}

async function Contenido({ params }: Pick<PageProps<"/ayuda/[pagina]">, "params">) {
  const p = PAGINAS[(await params).pagina];
  if (!p) notFound();
  return (
    <article className="tarjeta mx-auto max-w-3xl p-6 sm:p-8">
      <h1 className="text-3xl font-extrabold text-marca-900">{p.titulo}</h1>
      <p className="mb-6 text-slate-700">{p.descripcion}</p>
      {p.secciones.map(([t, d]) => (
        <section key={t} className="border-t border-slate-200 py-4">
          <h2 className="font-bold text-marca-900">{t}</h2>
          <p className="mt-1 text-slate-800">{d}</p>
        </section>
      ))}
      <Link href="/" className="btn-secundario mt-4">
        Volver a la tienda
      </Link>
    </article>
  );
}

export default function PaginaAyuda({ params }: PageProps<"/ayuda/[pagina]">) {
  return (
    <div className="contenedor py-8">
      <Suspense fallback={<p className="text-center" role="status">Cargando…</p>}>
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
