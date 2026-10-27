"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTienda } from "@/contexto/tienda";
import { api, ErrorApi } from "@/lib/api-cliente";
import { precio } from "@/lib/formato";
import type { PedidoRegistrado } from "@/lib/tipos";
import { Icono } from "../icono";
import { ImagenProducto } from "../imagen-producto";
import { CarritoVacio } from "./carrito";

const ENTREGAS = [
  { valor: "Recojo en tienda", icono: "store", titulo: "Recojo en tienda", detalle: "Retira tu pedido en la tienda FerreMax presentando tu número de pedido.", costo: "Sin costo" },
  {
    valor: "Delivery en Lima Metropolitana",
    icono: "local_shipping",
    titulo: "Delivery en Lima Metropolitana",
    detalle: "Entrega en obra o domicilio. La fecha y el costo del envío se coordinan después de registrar el pedido.",
    costo: "Por coordinar",
  },
];

const PAGOS = [
  { valor: "Yape", icono: "qr_code_2", detalle: "Pago desde tu celular" },
  { valor: "Plin", icono: "qr_code_2", detalle: "Pago desde tu celular" },
  { valor: "Visa", icono: "credit_card", detalle: "Tarjeta de crédito o débito" },
  { valor: "Mastercard", icono: "credit_card", detalle: "Tarjeta de crédito o débito" },
  { valor: "PagoEfectivo", icono: "account_balance", detalle: "Código CIP para pagar en agentes o banca móvil" },
  { valor: "Efectivo", icono: "payments", detalle: "Paga al recoger o al recibir tu pedido" },
];

function Opcion({ nombre, valor, elegido, alElegir, icono, titulo, detalle, extra }: { nombre: string; valor: string; elegido: boolean; alElegir: () => void; icono: string; titulo: string; detalle: string; extra?: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 bg-white p-4 ${elegido ? "border-acento-700 ring-2 ring-acento-100" : "border-slate-200"}`}>
      <input type="radio" name={nombre} value={valor} checked={elegido} onChange={alElegir} className="mt-1 size-4 accent-acento-700" />
      <Icono nombre={icono} className="text-2xl text-marca-800" />
      <span className="flex-1">
        <strong className="block text-marca-900">{titulo}</strong>
        <span className="text-sm text-slate-700">{detalle}</span>
      </span>
      {extra && <span className="text-sm font-semibold text-marca-900">{extra}</span>}
    </label>
  );
}

export function Confirmar() {
  const router = useRouter();
  const { listo, carrito, unidades, subtotal, sesion, guardarPedido } = useTienda();
  const [entrega, setEntrega] = useState(ENTREGAS[0].valor);
  const [pago, setPago] = useState(PAGOS[0].valor);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const costoEnvio = ENTREGAS.find((e) => e.valor === entrega)!.costo;

  if (!listo) return <p className="py-10 text-center text-slate-700" role="status">Cargando…</p>;
  if (carrito.length === 0) return <CarritoVacio titulo="No hay productos para confirmar" texto="Tu carrito está vacío." />;

  const realizar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const r = await api<Omit<PedidoRegistrado, "codigo_cliente">>("/api/carrito/confirmar", {
        cuerpo: {
          id_sesion: sesion?.id_sesion ?? "SIN-SESION",
          codigo_cliente: sesion?.codigo_cliente ?? "CLI-000",
          escenario: sesion?.escenario ?? null,
          condicion: sesion?.condicion ?? "ML",
          timestamp: Date.now(),
          items: carrito.map((i) => ({ sku: i.sku, cantidad: i.cantidad, precio: i.precio, origen: i.origen })),
          total: subtotal,
          entrega,
          pago,
        },
      });
      guardarPedido({ ...r, codigo_cliente: sesion?.codigo_cliente ?? "CLI-000" });
      router.push("/pedido-registrado");
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo registrar el pedido. Inténtalo nuevamente.");
      setEnviando(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <section className="tarjeta p-5" aria-labelledby="paso1">
          <h2 id="paso1" className="font-bold text-marca-900">
            <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-marca-900 text-sm text-white">1</span>Datos del cliente
          </h2>
          <p className="mb-3 text-sm text-slate-700">En este prototipo el cliente se identifica solo por un código anónimo; no se piden nombres, documentos ni teléfonos.</p>
          <label htmlFor="codigo-cliente" className="text-sm font-semibold text-marca-900">
            Código de cliente
          </label>
          <input id="codigo-cliente" readOnly className="campo mt-1 bg-slate-50 font-mono" value={sesion?.codigo_cliente ?? "Sin sesión de evaluación"} />
        </section>

        <fieldset className="tarjeta space-y-3 p-5">
          <legend className="sr-only">Método de entrega</legend>
          <h2 className="font-bold text-marca-900" aria-hidden="true">
            <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-marca-900 text-sm text-white">2</span>Método de entrega
          </h2>
          {ENTREGAS.map((e) => (
            <Opcion key={e.valor} nombre="entrega" valor={e.valor} elegido={entrega === e.valor} alElegir={() => setEntrega(e.valor)} icono={e.icono} titulo={e.titulo} detalle={e.detalle} extra={e.costo} />
          ))}
        </fieldset>

        <fieldset className="tarjeta p-5">
          <legend className="sr-only">Método de pago</legend>
          <h2 className="font-bold text-marca-900" aria-hidden="true">
            <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-marca-900 text-sm text-white">3</span>Método de pago
          </h2>
          <p className="mb-3 text-sm text-slate-700">Pago simulado: no se realiza ningún cobro real.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAGOS.map((p) => (
              <Opcion key={p.valor} nombre="pago" valor={p.valor} elegido={pago === p.valor} alElegir={() => setPago(p.valor)} icono={p.icono} titulo={p.valor} detalle={p.detalle} />
            ))}
          </div>
        </fieldset>
      </div>

      <aside className="tarjeta h-fit p-5 lg:sticky lg:top-4" aria-labelledby="resumen-pedido">
        <h2 id="resumen-pedido" className="flex items-center justify-between text-lg font-bold text-marca-900">
          Resumen de compra <span className="chip bg-marca-50 text-marca-800">{unidades === 1 ? "1 producto" : `${unidades} productos`}</span>
        </h2>
        <ul className="mt-4 space-y-3">
          {carrito.map((i) => (
            <li key={i.sku} className="flex items-center gap-3 text-sm">
              <ImagenProducto sku={i.sku} nombre={i.nombre} categoria={i.categoria} sizes="48px" className="w-12 shrink-0" />
              <span className="flex-1">
                <span className="block font-semibold text-marca-900">{i.nombre}</span>
                <span className="text-xs text-slate-600">
                  {i.marca} · Cant: {i.cantidad}
                </span>
              </span>
              <span className="font-semibold">{precio(i.precio * i.cantidad)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal productos</dt>
            <dd>{precio(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Envío</dt>
            <dd>{costoEnvio}</dd>
          </div>
          <div className="flex justify-between text-lg font-extrabold text-marca-900">
            <dt>Total a pagar</dt>
            <dd>{precio(subtotal)}</dd>
          </div>
        </dl>
        <p className="text-right text-xs text-slate-600">Precios con IGV{costoEnvio === "Por coordinar" ? " · sin envío" : ""}</p>
        {error && (
          <p className="mt-4 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
            <Icono nombre="error" /> {error}
          </p>
        )}
        <button type="button" className="btn-primario mt-4 w-full py-3" disabled={enviando} aria-busy={enviando} onClick={realizar}>
          <Icono nombre="lock" /> {enviando ? "Registrando pedido…" : `Realizar pedido · ${precio(subtotal)}`}
        </button>
        <p className="mt-3 text-xs text-slate-600">Al hacer clic en «Realizar pedido» se registra tu pedido y la hora de cierre de tu selección.</p>
      </aside>
    </div>
  );
}
