// Formas de respuesta de las rutas /api/admin/* (docs/api.md, sección "Administración").
import type { Modo } from "@/lib/tipos";

export type VarianteMl = "COMPLETO" | "REGLAS";

export interface Resumen {
  n: number;
  media: number | null;
  mediana: number | null;
  de: number | null;
  min?: number | null;
  max?: number | null;
}

export interface FichaVariante {
  variables?: string[];
  n_ejemplos?: number;
  n_positivos?: number;
  n_contextos?: number;
  cobertura_candidatos?: number;
  ap_validacion?: Record<string, number>;
}

export interface Reordenador extends FichaVariante {
  tipo?: string;
  version?: string;
  fecha?: string;
  n_boletas?: number;
  validacion?: string;
  semilla?: number;
  n_reglas?: number;
  periodo?: [string, string];
  por_variante?: Record<string, FichaVariante>;
}

export interface ConfigAdmin {
  id?: number;
  modo_activo: Modo;
  k: number;
  soporte_min: number;
  confianza_min: number;
  lift_min: number;
  peso_contenido: number;
  variante_ml: VarianteMl;
  fuente_datos?: string;
  reordenador?: Reordenador | null;
}

export interface Regla {
  id: number;
  antecedentes: string;
  consecuentes: string;
  soporte: number;
  confianza: number;
  lift: number;
  version_modelo: string | null;
}

export interface RespuestaReentrenar {
  status: string;
  message?: string;
  comprobantes?: number;
  reglas?: number;
  reordenador?: Reordenador;
}

export interface SesionEval {
  id_sesion: string;
  codigo_cliente: string;
  escenario: string;
  condicion: Modo;
  orden: string;
  inicio: string;
  fin: string | null;
  valida: boolean | null;
  completa?: boolean | null;
}

export interface Evento {
  id_evento: number;
  id_sesion: string;
  codigo_cliente: string;
  escenario: string | null;
  condicion: string;
  tipo_evento: string;
  texto_consulta: string | null;
  sku: string | null;
  posicion_recom: number | null;
  origen: string | null;
  timestamp: number | null;
}

export interface McNemar {
  n_pares?: number;
  ambos: number;
  solo_primero: number;
  solo_segundo: number;
  ninguno: number;
  p_valor: number;
}

export interface AgregadoCondicion {
  tiempo_seleccion_s: Resumen;
  precision_5: Resumen;
  recs_aceptadas: Resumen;
  sesiones_validas_completas: number;
  sesiones_registradas: number;
}

export interface MetricasSesion {
  id_sesion: string;
  codigo_cliente: string;
  escenario: string;
  condicion: string;
  orden: string;
  inicio: string;
  fin: string | null;
  valida: boolean;
  completa: boolean;
  tiempo_s: number | null;
  listas_mostradas: number;
  listas_sin_oportunidad?: number;
  recs_mostradas: number;
  recs_aceptadas: number;
  precision_5: number | null;
  acierto: boolean;
}

export interface Indicadores {
  agregados: Partial<Record<Modo, AgregadoCondicion>>;
  por_sesion: Partial<Record<Modo, MetricasSesion[]>>;
  mcnemar_exacto?: { CONV_vs_ML?: McNemar };
  definiciones?: Record<string, string>;
}

export interface Pedido {
  id: number;
  fecha: string;
  codigo_cliente: string;
  id_sesion: string | null;
  condicion: string | null;
  entrega: string | null;
  pago: string | null;
  estado: string;
  total: number;
}

export interface Cliente {
  codigo: string;
  tipo: string | null;
  primera_compra: string | null;
  participa_evaluacion: boolean;
  n_boletas?: number;
}

export interface Dashboard {
  pedidos: Pedido[];
  clientes: Cliente[];
  productos_bajo_stock: { sku: string; nombre?: string; stock?: number }[];
}

export interface MetricasModo {
  precision5: Resumen;
  recall5: Resumen;
  aciertos?: number;
}

export interface EvaluacionOffline {
  fecha_corrida?: string;
  n_prueba_evaluados?: number;
  n_prueba_total?: number;
  n_boletas_prueba_evaluadas?: number;
  n_entrenamiento?: number;
  n_comprobantes?: number;
  semilla?: number;
  particion?: string;
  protocolo?: string;
  k?: number;
  periodo_entrenamiento?: [string, string];
  periodo_prueba?: [string, string];
  umbrales?: { soporte_min?: number; confianza_min?: number; lift_min?: number };
  reglas_entrenadas?: number;
  cf_productos?: number | null;
  cf_clientes?: number | null;
  reordenador?: { tipo?: string; n_ejemplos?: number; n_positivos?: number; ap_validacion?: Record<string, number> } | null;
  cobertura_candidatos_prueba?: number;
  peso_contenido?: number;
  fuente_datos?: string;
  csv?: string | null;
  modos?: string[];
  por_modo: Record<string, MetricasModo>;
  mcnemar_exacto?: Record<string, McNemar>;
}
