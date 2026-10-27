"use client";

import Link from "next/link";
import { Icono } from "@/components/icono";
import { precio } from "@/lib/formato";
import type { Modo } from "@/lib/tipos";
import { useDatos } from "./contexto";
import type { Dashboard, Indicadores, Resumen } from "./tipos";
import { Alerta, CabeceraPagina, Cargando, num, Seccion, Tabla, Td, Th, Vacio } from "./ui";

export const CONDICIONES: Modo[] = ["CONV", "ML"];

export const METRICAS_SESION = [
  { clave: "tiempo_seleccion_s", etiqueta: "Tiempo de selección (s)", decimales: 2 },
  { clave: "precision_5", etiqueta: "Precision@5 de sesión", decimales: 4 },
  { clave: "recs_aceptadas", etiqueta: "Recomendaciones aceptadas", decimales: 2 },
] as const;

export function VistaResumen() {
  const tablero = useDatos<Dashboard>("/api/admin/dashboard");
  const ind = useDatos<Indicadores>("/api/admin/indicadores");
  const d = tablero.datos;
  const totalVendido = d?.pedidos.reduce((s, p) => s + (p.total ?? 0), 0);

  const tarjetas = [
    { titulo: "Pedidos registrados", valor: d?.pedidos.length, icono: "receipt_long", href: "/admin/pedidos" },
    { titulo: "Clientes", valor: d?.clientes.length, icono: "group", href: "/admin/clientes" },
    { titulo: "Productos con poco stock (≤ 5)", valor: d?.productos_bajo_stock.length, icono: "inventory_2", href: "/admin/inventario" },
    { titulo: "Total vendido", valor: totalVendido === undefined ? undefined : precio(totalVendido), icono: "payments", href: "/admin/pedidos" },
  ];

  return (
    <div className="space-y-6">
      <CabeceraPagina titulo="Resumen" subtitulo="Estado general de la tienda y de la evaluación" />
      {tablero.error && <Alerta tipo="error">No se pudieron cargar los datos de la tienda: {tablero.error}</Alerta>}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tarjetas.map((t) => (
          <li key={t.titulo}>
            <Link href={t.href} className="tarjeta flex items-center gap-4 p-4 transition-shadow hover:shadow-md">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-marca-50 text-marca-900">
                <Icono nombre={t.icono} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-slate-600">{t.titulo}</span>
                <span className="block text-2xl font-bold text-marca-900 tabular-nums">{tablero.cargando && t.valor === undefined ? "…" : (t.valor ?? "—")}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {d && d.pedidos.length >= 500 && <p className="text-xs text-slate-600">El backend devuelve como máximo los 500 pedidos más recientes; los conteos y el total se calculan sobre ellos.</p>}

      <Seccion
        id="ind-resumen"
        icono="flaky"
        titulo="Indicadores de las sesiones de evaluación"
        subtitulo="Agregados por condición de las sesiones válidas y completas"
        acciones={
          <Link href="/admin/evaluacion" className="btn-secundario">
            Ver evaluación completa <Icono nombre="arrow_forward" />
          </Link>
        }
      >
        <TablaIndicadores estado={ind} />
      </Seccion>
    </div>
  );
}

export function TablaIndicadores({ estado }: { estado: { datos?: Indicadores; error?: string; cargando: boolean } }) {
  if (estado.cargando && !estado.datos) return <Cargando />;
  if (estado.error) return <Alerta tipo="error">No se pudieron cargar los indicadores: {estado.error}</Alerta>;
  const a = estado.datos?.agregados;
  if (!a) return <Vacio>Sin datos: aún no hay sesiones registradas.</Vacio>;
  return (
    <>
      <p className="mb-3 text-sm text-slate-700">
        Sesiones válidas y completas / registradas:{" "}
        {CONDICIONES.map((c, i) => (
          <span key={c}>
            {i > 0 && " · "}
            <strong>{c}</strong> {a[c]?.sesiones_validas_completas ?? 0} / {a[c]?.sesiones_registradas ?? 0}
          </span>
        ))}
      </p>
      <Tabla titulo="Indicadores por condición">
        <thead>
          <tr>
            <Th>Indicador</Th>
            <Th>Condición</Th>
            <Th derecha>n</Th>
            <Th derecha>Media</Th>
            <Th derecha>Mediana</Th>
            <Th derecha>DE (muestral)</Th>
            <Th derecha>Mín.</Th>
            <Th derecha>Máx.</Th>
          </tr>
        </thead>
        <tbody>
          {METRICAS_SESION.flatMap((m) =>
            CONDICIONES.map((c) => {
              const r: Resumen | undefined = a[c]?.[m.clave];
              return (
                <tr key={`${m.clave}-${c}`}>
                  <Td>{m.etiqueta}</Td>
                  <Td>{c}</Td>
                  <Td derecha>{r?.n ?? 0}</Td>
                  <Td derecha>{num(r?.media, m.decimales)}</Td>
                  <Td derecha>{num(r?.mediana, m.decimales)}</Td>
                  <Td derecha>{r && r.n > 1 ? num(r.de, m.decimales) : "—"}</Td>
                  <Td derecha>{num(r?.min, m.decimales)}</Td>
                  <Td derecha>{num(r?.max, m.decimales)}</Td>
                </tr>
              );
            }),
          )}
        </tbody>
      </Tabla>
      <p className="mt-2 text-xs text-slate-600">DE = desviación estándar muestral (—: menos de dos sesiones).</p>
    </>
  );
}
