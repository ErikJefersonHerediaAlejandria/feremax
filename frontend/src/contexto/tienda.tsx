"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, CLAVE_SESION, tokenSesion } from "@/lib/api-cliente";
import { crearAlmacen, useHidratado } from "./almacen";
import type { ConfigPublica, ItemCarrito, Origen, PedidoRegistrado, Producto, SesionActiva } from "@/lib/tipos";

const CLAVE_CARRITO = "ferremax_carrito";
const CLAVE_PEDIDO = "ferremax_ultimo_pedido";
const CLAVE_INICIOS = "ferremax_inicios";
const SIN_SESION = "SIN-SESION";
const CLIENTE_ANONIMO = "CLI-000";

export interface EventoParcial {
  tipo_evento: string;
  texto_consulta?: string | null;
  sku?: string | null;
  posicion_recom?: number | null;
  origen?: Origen | null;
  timestamp?: number;
}

interface Tienda {
  listo: boolean;
  carrito: ItemCarrito[];
  unidades: number;
  subtotal: number;
  sesion: SesionActiva | null;
  codigoCliente: string | null;
  config: ConfigPublica | null;
  esAdmin: boolean;
  aviso: string | null;
  ultimoPedido: PedidoRegistrado | null;
  avisar: (texto: string) => void;
  registrar: (e: EventoParcial) => void;
  marcarInicio: () => void;
  agregar: (p: Producto, origen: Origen, posicion?: number | null, cantidad?: number) => void;
  cambiarCantidad: (sku: string, cantidad: number) => void;
  quitar: (sku: string) => void;
  vaciar: () => void;
  guardarPedido: (p: PedidoRegistrado) => void;
  refrescarSesion: () => void;
}

const Contexto = createContext<Tienda | null>(null);
const almacenCarrito = crearAlmacen<ItemCarrito[]>(CLAVE_CARRITO, []);
const almacenPedido = crearAlmacen<PedidoRegistrado | null>(CLAVE_PEDIDO, null, "session");

export function useTienda() {
  const t = useContext(Contexto);
  if (!t) throw new Error("useTienda debe usarse dentro de <ProveedorTienda>");
  return t;
}

function leer<T>(almacen: Storage, clave: string, porDefecto: T): T {
  try {
    const v = almacen.getItem(clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(almacen: Storage, clave: string, valor: unknown) {
  try {
    almacen.setItem(clave, JSON.stringify(valor));
  } catch {
    // almacenamiento no disponible (modo privado): la tienda sigue funcionando en memoria
  }
}

export function ProveedorTienda({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  // Estado persistido en el navegador ("Tu carrito se conserva en este navegador").
  const listo = useHidratado();
  const carrito = almacenCarrito.useValor();
  const ultimoPedido = almacenPedido.useValor();
  const [sesion, setSesion] = useState<SesionActiva | null>(null);
  const [config, setConfig] = useState<ConfigPublica | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sesionRef = useRef<SesionActiva | null>(null);
  const carritoRef = useRef<ItemCarrito[]>([]);
  useEffect(() => {
    sesionRef.current = sesion;
    carritoRef.current = carrito;
  });

  const refrescarSesion = useCallback(() => {
    if (!tokenSesion()) {
      setSesion(null);
      return;
    }
    api<SesionActiva | null>("/api/sesiones/activa")
      .then((s) => {
        setSesion(s);
        // El token ya no corresponde a una sesión activa: se desvincula el navegador.
        if (!s) {
          localStorage.removeItem(CLAVE_SESION);
          window.dispatchEvent(new Event("ferremax:vinculo-sesion"));
        }
      })
      .catch(() => undefined);
  }, []);

  // Sesión activa: al cargar, cada 5 s y al volver a la pestaña (como en v1).
  useEffect(() => {
    const inicial = setTimeout(refrescarSesion, 0);
    const id = setInterval(refrescarSesion, 5000);
    window.addEventListener("focus", refrescarSesion);
    return () => {
      clearTimeout(inicial);
      clearInterval(id);
      window.removeEventListener("focus", refrescarSesion);
    };
  }, [refrescarSesion]);

  useEffect(() => {
    api<ConfigPublica>("/api/admin/config").then(setConfig).catch(() => undefined);
  }, []);
  // ¿Hay un admin con sesión en este navegador? Solo entonces se muestra el indicador de sesión de evaluación.
  const enAdmin = ruta.startsWith("/admin");
  useEffect(() => {
    api<{ valido: boolean }>("/api/admin/verificar")
      .then((r) => setEsAdmin(r.valido))
      .catch(() => setEsAdmin(false));
  }, [enAdmin]);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(null), 2500);
  }, []);

  const enviar = useCallback((e: EventoParcial) => {
    const s = sesionRef.current;
    // El servidor fija sesión, cliente y condición a partir del token; estos valores solo completan el contrato.
    api("/api/eventos", {
      cuerpo: {
        id_sesion: s?.id_sesion ?? SIN_SESION,
        codigo_cliente: s?.codigo_cliente ?? CLIENTE_ANONIMO,
        escenario: s?.escenario ?? null,
        condicion: s?.condicion ?? "ML",
        tipo_evento: e.tipo_evento,
        texto_consulta: e.texto_consulta ?? null,
        sku: e.sku ?? null,
        posicion_recom: e.posicion_recom ?? null,
        origen: e.origen ?? null,
        timestamp: e.timestamp ?? Date.now(),
      },
    }).catch(() => undefined);
  }, []);

  /** INICIO_BUSQUEDA: una vez por sesión y pestaña, en la primera interacción del participante. */
  const marcarInicio = useCallback(() => {
    const id = sesionRef.current?.id_sesion ?? SIN_SESION;
    const inicios = leer<string[]>(sessionStorage, CLAVE_INICIOS, []);
    if (inicios.includes(id)) return;
    escribir(sessionStorage, CLAVE_INICIOS, [...inicios, id]);
    enviar({ tipo_evento: "INICIO_BUSQUEDA" });
  }, [enviar]);

  const registrar = useCallback(
    (e: EventoParcial) => {
      marcarInicio();
      enviar(e);
    },
    [enviar, marcarInicio],
  );

  // Primera interacción fuera del panel admin → INICIO_BUSQUEDA.
  useEffect(() => {
    if (ruta.startsWith("/admin")) return;
    const alInteractuar = () => marcarInicio();
    window.addEventListener("pointerdown", alInteractuar, { once: true });
    window.addEventListener("keydown", alInteractuar, { once: true });
    return () => {
      window.removeEventListener("pointerdown", alInteractuar);
      window.removeEventListener("keydown", alInteractuar);
    };
  }, [ruta, marcarInicio, sesion?.id_sesion]);

  const agregar = useCallback(
    (p: Producto, origen: Origen, posicion: number | null = null, cantidad = 1) => {
      if (p.stock <= 0) return;
      almacenCarrito.escribir((c) => {
        const previo = c.find((i) => i.sku === p.sku);
        if (previo) {
          return c.map((i) => (i.sku === p.sku ? { ...i, cantidad: Math.min(i.cantidad + cantidad, p.stock), stock: p.stock, precio: p.precio } : i));
        }
        const nuevo: ItemCarrito = {
          sku: p.sku,
          nombre: p.nombre,
          marca: p.marca,
          categoria: p.categoria,
          unidad: p.unidad,
          precio: p.precio,
          stock: p.stock,
          cantidad: Math.min(cantidad, p.stock),
          origen,
          posicion_recom: origen === "RECOMENDACION" ? posicion : null,
        };
        return [...c, nuevo];
      });
      registrar({ tipo_evento: "PRODUCTO_AGREGADO", sku: p.sku, origen, posicion_recom: origen === "RECOMENDACION" ? posicion : null });
    },
    [registrar],
  );

  const quitar = useCallback(
    (sku: string) => {
      const item = carritoRef.current.find((i) => i.sku === sku);
      if (item) registrar({ tipo_evento: "PRODUCTO_RETIRADO", sku, origen: item.origen, posicion_recom: item.posicion_recom });
      almacenCarrito.escribir((c) => c.filter((i) => i.sku !== sku));
    },
    [registrar],
  );

  const cambiarCantidad = useCallback(
    (sku: string, cantidad: number) => {
      if (cantidad <= 0) return quitar(sku);
      almacenCarrito.escribir((c) => c.map((i) => (i.sku === sku ? { ...i, cantidad: i.stock > 0 ? Math.min(cantidad, i.stock) : cantidad } : i)));
    },
    [quitar],
  );

  const vaciar = useCallback(() => {
    for (const i of carritoRef.current) registrar({ tipo_evento: "PRODUCTO_RETIRADO", sku: i.sku, origen: i.origen, posicion_recom: i.posicion_recom });
    almacenCarrito.escribir([]);
  }, [registrar]);

  const guardarPedido = useCallback((p: PedidoRegistrado) => {
    almacenPedido.escribir(p);
    almacenCarrito.escribir([]);
  }, []);

  const valor = useMemo<Tienda>(
    () => ({
      listo,
      carrito,
      unidades: carrito.reduce((s, i) => s + i.cantidad, 0),
      subtotal: Math.round(carrito.reduce((s, i) => s + i.precio * i.cantidad, 0) * 100) / 100,
      sesion,
      codigoCliente: sesion?.codigo_cliente ?? null,
      config,
      esAdmin,
      aviso,
      ultimoPedido,
      avisar,
      registrar,
      marcarInicio,
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
      guardarPedido,
      refrescarSesion,
    }),
    [listo, carrito, sesion, config, esAdmin, aviso, ultimoPedido, avisar, registrar, marcarInicio, agregar, cambiarCantidad, quitar, vaciar, guardarPedido, refrescarSesion],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
