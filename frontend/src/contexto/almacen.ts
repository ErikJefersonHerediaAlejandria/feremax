// Estado persistido en el navegador (localStorage / sessionStorage) expuesto como "external store" de React
// (useSyncExternalStore): en el servidor y durante la hidratación vale el valor por defecto.
import { useSyncExternalStore } from "react";

type Oyente = () => void;

export function crearAlmacen<T>(clave: string, porDefecto: T, tipo: "local" | "session" = "local") {
  let valor: T | undefined;
  const oyentes = new Set<Oyente>();
  const almacen = () => (tipo === "local" ? localStorage : sessionStorage);

  const leer = (): T => {
    if (valor === undefined) {
      try {
        const v = almacen().getItem(clave);
        valor = v ? (JSON.parse(v) as T) : porDefecto;
      } catch {
        valor = porDefecto;
      }
    }
    return valor;
  };

  const escribir = (siguiente: T | ((previo: T) => T)) => {
    valor = typeof siguiente === "function" ? (siguiente as (p: T) => T)(leer()) : siguiente;
    try {
      almacen().setItem(clave, JSON.stringify(valor));
    } catch {
      // modo privado o almacenamiento lleno: se mantiene en memoria
    }
    oyentes.forEach((o) => o());
  };

  const suscribir = (o: Oyente) => {
    oyentes.add(o);
    // Cambios hechos en otra pestaña (solo localStorage emite "storage")
    const alCambiar = (e: StorageEvent) => {
      if (e.key === clave) {
        valor = undefined;
        o();
      }
    };
    window.addEventListener("storage", alCambiar);
    return () => {
      oyentes.delete(o);
      window.removeEventListener("storage", alCambiar);
    };
  };

  const useValor = () => useSyncExternalStore(suscribir, leer, () => porDefecto);
  return { leer, escribir, useValor };
}

const sinSuscripcion = () => () => {};
/** true en el navegador una vez hidratado; false en el servidor. */
export const useHidratado = () =>
  useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
