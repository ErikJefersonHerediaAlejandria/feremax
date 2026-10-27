"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTienda } from "@/contexto/tienda";
import { precio, urlBusqueda } from "@/lib/formato";
import { Icono } from "../icono";

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-1 text-2xl font-extrabold tracking-tight" aria-label="FerreMax, ir al inicio">
      <Icono nombre="construction" className={claro ? "text-acento-500" : "text-acento-600"} />
      <span className={claro ? "text-white" : "text-marca-900"}>FERRE</span>
      <span className="text-acento-500">MAX</span>
    </Link>
  );
}

/** Indicador visible solo para el administrador (este navegador tiene sesión del panel): muestra la condición. */
function IndicadorSesion() {
  const { esAdmin, sesion } = useTienda();
  if (!esAdmin) return null;
  return (
    <div className="bg-amber-100 text-amber-950">
      <p className="contenedor flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-xs font-semibold" role="status">
        <Icono nombre="science" />
        {sesion ? (
          <>
            Sesión de evaluación {sesion.id_sesion} · Cliente {sesion.codigo_cliente} · Condición{" "}
            <span className="rounded bg-amber-950 px-1.5 py-0.5 text-amber-50">{sesion.condicion}</span> · Escenario: {sesion.escenario}
          </>
        ) : (
          "Modo administrador · sin sesión de evaluación vinculada a este navegador"
        )}
        <Link href="/admin/configuracion" className="ml-auto underline">
          Panel
        </Link>
      </p>
    </div>
  );
}

export function BuscadorNecesidad({ grande = false, valorInicial = "" }: { grande?: boolean; valorInicial?: string }) {
  const router = useRouter();
  const { registrar, marcarInicio } = useTienda();
  const [texto, setTexto] = useState(valorInicial);
  return (
    <form
      role="search"
      className="flex w-full"
      onSubmit={(e) => {
        e.preventDefault();
        const q = texto.trim();
        if (!q) return;
        registrar({ tipo_evento: "CONSULTA", texto_consulta: q, origen: "BUSQUEDA" });
        router.push(urlBusqueda({ q }));
      }}
    >
      <label htmlFor={grande ? "necesidad" : "buscar"} className="sr-only">
        ¿Qué necesitas hacer?
      </label>
      <input
        id={grande ? "necesidad" : "buscar"}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={marcarInicio}
        placeholder={grande ? "Escribe tu necesidad, por ejemplo: pintar un dormitorio, instalar un lavatorio, colgar repisas" : "¿Qué necesitas hacer? Ej.: pintar una pared"}
        className={`campo rounded-r-none ${grande ? "py-3.5 text-base" : ""}`}
        maxLength={300}
      />
      <button type="submit" className={`btn-primario rounded-l-none ${grande ? "px-6" : ""}`} aria-label="Buscar">
        <Icono nombre="search" />
        {grande && <span className="hidden sm:inline">Buscar productos</span>}
      </button>
    </form>
  );
}

export function Encabezado() {
  const { unidades, subtotal, codigoCliente } = useTienda();
  const ruta = usePathname();
  const enlace = (href: string, texto: string) => (
    <Link
      href={href}
      className={`rounded px-3 py-2 text-sm font-semibold hover:bg-marca-800 ${ruta === href ? "bg-marca-800 text-white" : "text-marca-50"}`}
      aria-current={ruta === href ? "page" : undefined}
    >
      {texto}
    </Link>
  );
  return (
    <header>
      <IndicadorSesion />
      <div className="hidden bg-marca-950 text-xs text-marca-100 md:block">
        <div className="contenedor flex items-center justify-between py-1.5">
          <p>Envíos a todo el Perú · Delivery rápido en Lima Metropolitana</p>
          <p className="flex items-center gap-4">
            <span>
              <Icono nombre="call" /> (01) 712 3456
            </span>
            <Link href="/ayuda/faq" className="hover:underline">
              Ayuda
            </Link>
            <Link href="/mi-cuenta" className="hover:underline">
              Seguimiento de pedidos
            </Link>
          </p>
        </div>
      </div>
      <div className="border-b border-slate-200 bg-white">
        <div className="contenedor flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
          <Logo />
          <div className="order-3 w-full md:order-2 md:w-auto md:flex-1">
            <BuscadorNecesidad />
          </div>
          <nav className="order-2 ml-auto flex items-center gap-1 md:order-3" aria-label="Cuenta y carrito">
            <Link href="/mi-cuenta" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100" aria-label={codigoCliente ? `Mi cuenta (${codigoCliente})` : "Mi cuenta"}>
              <Icono nombre="person" className="text-2xl text-marca-900" />
              <span className="hidden text-xs leading-tight sm:block">
                <span className="block text-slate-600">{codigoCliente ? `Hola, ${codigoCliente}` : "Hola, inicia sesión"}</span>
                <span className="font-bold text-marca-900">Mi cuenta</span>
              </span>
            </Link>
            <Link href="/carrito" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100" aria-label={`Carrito: ${unidades} productos, ${precio(subtotal)}`}>
              <span className="relative">
                <Icono nombre="shopping_cart" className="text-2xl text-marca-900" />
                <span className={`absolute -right-2 -top-1.5 min-w-5 rounded-full px-1 text-center text-[11px] font-bold leading-5 ${unidades ? "bg-acento-700 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {unidades}
                </span>
              </span>
              <span className="hidden text-xs leading-tight sm:block">
                <span className="block text-slate-600">Mi carrito</span>
                <span className="font-bold text-marca-900">{precio(subtotal)}</span>
              </span>
            </Link>
          </nav>
        </div>
      </div>
      <nav className="bg-marca-900" aria-label="Principal">
        <div className="contenedor flex items-center gap-1 overflow-x-auto py-1">
          {enlace("/", "Inicio")}
          {enlace("/busqueda", "Productos")}
          {enlace("/#categorias", "Categorías")}
          <span className="ml-auto hidden whitespace-nowrap text-xs text-marca-100 lg:block">Venta directa & mayorista · Boleta o Factura</span>
        </div>
      </nav>
    </header>
  );
}

export function Aviso() {
  const { aviso } = useTienda();
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {aviso && (
        <p className="pointer-events-auto flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          <Icono nombre="check_circle" /> {aviso}
        </p>
      )}
    </div>
  );
}
