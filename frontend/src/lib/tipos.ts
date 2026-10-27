export type Modo = "CONV" | "ML";
export type Origen = "CATEGORIA" | "BUSQUEDA" | "RECOMENDACION";

export interface Producto {
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  unidad: string | null;
  uso: string | null;
  precio: number;
  stock: number;
}

export interface ProductoPuntuado extends Producto {
  puntaje: number | null;
  terminos: string[];
  fuente: string | null;
  posicion: number;
}

export interface Categoria {
  categoria: string;
  subcategorias: string[];
}

export interface SesionActiva {
  id_sesion: string;
  codigo_cliente: string;
  escenario: string;
  condicion: Modo;
  orden: string;
  inicio: string;
}

export interface ItemCarrito {
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  unidad: string | null;
  precio: number;
  stock: number;
  cantidad: number;
  origen: Origen;
  posicion_recom: number | null;
}

export interface PedidoRegistrado {
  id_pedido: number;
  total: number;
  estado: string;
  fecha: string;
  entrega: string | null;
  pago: string | null;
  codigo_cliente: string;
  items: { sku: string; nombre: string; cantidad: number; precio: number; subtotal: number; origen: string }[];
}

export interface ConfigPublica {
  k: number;
  fuente_datos: string;
}
