"use client";

import Link from "next/link";
import { useTienda } from "@/contexto/tienda";
import { fechaHora, numeroPedido, precio } from "@/lib/formato";
import { Icono } from "../icono";
import { ImagenProducto } from "../imagen-producto";
import { Recomendaciones } from "./recomendaciones";

export function PedidoRegistradoVista() {
  const { listo, ultimoPedido: p } = useTienda();
  if (!listo) return <p className="py-10 text-center" role="status">Cargando…</p>;
  if (!p)
    return (
      <div className="tarjeta mx-auto max-w-lg p-10 text-center">
        <Icono nombre="receipt_long" className="text-5xl text-slate-500" />
        <h1 className="mt-2 text-xl font-bold text-marca-900">No hay un pedido reciente</h1>
        <p className="text-slate-700">Aún no has confirmado un pedido en esta visita.</p>
        <Link href="/" className="btn-primario mt-5">
          Ir a la tienda
        </Link>
      </div>
    );
  const recojo = /recojo/i.test(p.entrega ?? "");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="tarjeta p-6 text-center">
        <Icono nombre="check_circle" lleno className="text-6xl text-emerald-600" />
        <h1 className="mt-2 text-2xl font-extrabold text-marca-900">¡Pedido N° {numeroPedido(p.id_pedido)} registrado!</h1>
        <p className="text-slate-700">
          Tu pedido quedó registrado el {fechaHora(p.fecha)} para el cliente {p.codigo_cliente}.
        </p>
        <p className="mt-3 flex flex-wrap justify-center gap-2">
          {p.pago && <span className="chip bg-marca-50 text-marca-800">Medio de pago: {p.pago}</span>}
          <span className="chip bg-amber-100 text-amber-900">
            <Icono nombre="receipt_long" /> Estado: {p.estado}
          </span>
        </p>
      </section>
      <section className="tarjeta flex gap-4 p-5">
        <Icono nombre={recojo ? "store" : "local_shipping"} className="text-3xl text-acento-700" />
        <div className="flex-1">
          <h2 className="font-bold text-marca-900">Modalidad de entrega</h2>
          <p>{p.entrega ?? "Por coordinar"}</p>
          <p className="mt-1 text-sm text-slate-700">{recojo ? "Presenta tu número de pedido al recoger en tienda." : "Nos comunicaremos para coordinar la fecha y el costo del envío."}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-600">Número de pedido</p>
          <p className="font-mono text-lg font-bold">{numeroPedido(p.id_pedido)}</p>
        </div>
      </section>
      <section className="tarjeta p-5" aria-labelledby="incluidos">
        <h2 id="incluidos" className="mb-3 font-bold text-marca-900">
          Productos incluidos ({p.items.length === 1 ? "1 artículo" : `${p.items.length} artículos`})
        </h2>
        <ul className="divide-y divide-slate-200">
          {p.items.map((i) => (
            <li key={i.sku} className="flex items-center gap-3 py-3 text-sm">
              <ImagenProducto sku={i.sku} nombre={i.nombre} categoria={null} sizes="48px" className="w-12 shrink-0" />
              <span className="flex-1">
                <span className="block font-semibold text-marca-900">{i.nombre}</span>
                <span className="text-xs text-slate-600">
                  Cant: {i.cantidad} × {precio(i.precio)}
                </span>
              </span>
              <span className="font-semibold">{precio(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Envío</dt>
            <dd>{recojo ? "Sin costo" : "Por coordinar"}</dd>
          </div>
          <div className="flex justify-between text-lg font-extrabold text-marca-900">
            <dt>Total del pedido</dt>
            <dd>{precio(p.total)}</dd>
          </div>
        </dl>
      </section>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/mi-cuenta" className="btn-secundario">
          <Icono nombre="visibility" /> Ver mis pedidos
        </Link>
        <Link href="/" className="btn-primario">
          <Icono nombre="storefront" /> Seguir comprando
        </Link>
      </div>
    </div>
  );
}

export function MiCuenta() {
  const { listo, sesion, ultimoPedido: p, carrito } = useTienda();
  if (!listo) return <p className="py-10 text-center" role="status">Cargando…</p>;
  return (
    <div className="space-y-6">
      <section className="tarjeta flex flex-wrap items-center gap-4 p-5">
        <span className="flex size-14 items-center justify-center rounded-full bg-marca-900 text-white">
          <Icono nombre="person" className="text-3xl" />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-marca-900">{sesion ? `Hola, ${sesion.codigo_cliente}` : "Hola"}</h1>
          <p className="text-sm text-slate-700">
            {sesion ? "Revisa el pedido que registraste en esta visita." : "No hay una sesión de evaluación activa. Los clientes se identifican solo por un código anónimo."}
          </p>
        </div>
        <span className="chip bg-acento-50 text-acento-800">Perfil experimental · Tesis UPN 2026</span>
      </section>

      <section className="tarjeta p-5" aria-labelledby="mis-pedidos">
        <h2 id="mis-pedidos" className="font-bold text-marca-900">
          Mis pedidos
        </h2>
        <p className="mb-3 text-sm text-slate-700">Pedido confirmado en esta visita</p>
        {p ? (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-600">
                <tr>
                  {["N° pedido", "Fecha", "Productos", "Total", "Estado", "Acción"].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-3 pr-3 font-mono">#{numeroPedido(p.id_pedido)}</td>
                  <td className="py-3 pr-3">{fechaHora(p.fecha)}</td>
                  <td className="py-3 pr-3">{p.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(", ")}</td>
                  <td className="py-3 pr-3 font-bold">{precio(p.total)}</td>
                  <td className="py-3 pr-3">
                    <span className="chip bg-amber-100 text-amber-900">{p.estado}</span>
                  </td>
                  <td className="py-3">
                    <Link href="/pedido-registrado" className="font-semibold text-acento-800 hover:underline">
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-slate-700">
            <Icono nombre="package_2" /> Aún no has registrado pedidos en esta visita.{" "}
            <Link href="/" className="font-semibold text-acento-800 underline">
              Ir a la tienda
            </Link>
          </p>
        )}
      </section>

      {sesion && (
        <Recomendaciones contexto="cuenta" skus={carrito.map((i) => i.sku)} titulo="Recomendados para ti" subtitulo="Según tu historial de compras y tu carrito" />
      )}
    </div>
  );
}

export function LoginCliente() {
  const { sesion } = useTienda();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-marca-900">Accede a tu cuenta FerreMax</h1>
        <p className="text-slate-700">En este prototipo cada cliente se identifica con un código anónimo asignado a su sesión de evaluación.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="tarjeta p-6" aria-labelledby="iniciar">
          <h2 id="iniciar" className="text-xl font-bold text-marca-900">
            Iniciar sesión
          </h2>
          <p className="mb-4 text-sm text-slate-700">Tu código de cliente para esta sesión.</p>
          <label htmlFor="login-codigo" className="text-sm font-semibold text-marca-900">
            Código de cliente
          </label>
          <div className="relative mt-1">
            <Icono nombre="badge" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input id="login-codigo" readOnly className="campo bg-slate-50 pl-10 font-mono" value={sesion?.codigo_cliente ?? "Sin sesión de evaluación activa"} />
          </div>
          <Link href="/mi-cuenta" className="btn-primario mt-4 w-full">
            Ingresar <Icono nombre="arrow_forward" />
          </Link>
          <p className="mt-4 flex gap-2 rounded-lg bg-superficie p-3 text-sm text-slate-700">
            <Icono nombre="engineering" className="text-acento-700" />
            <span>
              <strong className="block text-marca-900">¿Eres maestro de obra o contratista?</strong>
              Consulta por cotizaciones por volumen de cemento, fierro y tuberías al (01) 712 3456.
            </span>
          </p>
        </section>
        <section className="tarjeta p-6" aria-labelledby="crear">
          <h2 id="crear" className="text-xl font-bold text-marca-900">
            Crear cuenta
          </h2>
          <p className="mb-4 text-sm text-slate-700">El registro de clientes no está habilitado en el prototipo.</p>
          <p className="flex gap-2 text-sm text-slate-700">
            <Icono nombre="shield_person" className="text-marca-800" />
            No se solicitan nombres, documentos de identidad, teléfonos ni correos. Cada participante recibe un código anónimo (por ejemplo, CLI-0001) al iniciar su sesión de evaluación.
          </p>
          <button type="button" className="btn-secundario mt-4 w-full" disabled>
            Registro deshabilitado
          </button>
          <Link href="/" className="btn-primario mt-3 w-full">
            <Icono nombre="storefront" /> Ir a la tienda
          </Link>
        </section>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {[
          ["shopping_basket", "Guarda tu carrito", "Tu carrito se conserva en este navegador para continuar tu compra."],
          ["local_shipping", "Sigue tus pedidos", "Consulta el pedido que registraste desde Mi cuenta."],
          ["smart_toy", "Recomendaciones", "Sugerencias de complementos para los productos que buscas y agregas al carrito."],
        ].map(([i, t, d]) => (
          <li key={t} className="tarjeta flex gap-3 p-4">
            <Icono nombre={i} className="text-2xl text-acento-700" />
            <span>
              <strong className="block text-marca-900">{t}</strong>
              <span className="text-sm text-slate-700">{d}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
