import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Modo } from '../generated/prisma/enums.js';

export interface ProductoPuntuado {
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  unidad: string | null;
  uso: string | null;
  precio: number;
  stock: number;
  puntaje: number | null;
  terminos: string[];
  fuente: string | null;
  posicion: number;
}

export interface PeticionRecomendar {
  skus: string[];
  k: number;
  modo: Modo;
  codigo_cliente?: string | null;
}

/** Contrato del servicio recommender (FastAPI interno). Se sustituye por un doble en los tests e2e. */
export abstract class Recommender {
  abstract recomendar(p: PeticionRecomendar): Promise<ProductoPuntuado[]>;
  abstract buscarNecesidad(
    texto: string,
    k: number,
  ): Promise<ProductoPuntuado[]>;
  abstract reentrenar(): Promise<Record<string, unknown>>;
  abstract evaluacionOffline(): Promise<Record<string, unknown>>;
  abstract recargar(): Promise<void>;
  abstract salud(): Promise<boolean>;
}

@Injectable()
export class RecommenderHttp extends Recommender {
  private readonly log = new Logger('Recommender');
  private readonly url = (
    process.env.RECOMMENDER_URL ?? 'http://localhost:8001'
  ).replace(/\/$/, '');
  private readonly clave = process.env.RECOMMENDER_KEY ?? '';

  private async llamar<T>(
    ruta: string,
    cuerpo?: unknown,
    timeoutMs = 10_000,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.url}${ruta}`, {
        method: cuerpo === undefined && ruta === '/health' ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': this.clave,
        },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      this.log.error(`${ruta}: ${(e as Error).message}`);
      throw new BadGatewayException({
        detail: 'El servicio de recomendación no está disponible',
      });
    }
    if (res.status === 409)
      throw new ConflictException({
        detail: 'Ya hay un reentrenamiento o evaluación en curso',
      });
    if (!res.ok) {
      this.log.error(`${ruta}: HTTP ${res.status}`);
      throw new BadGatewayException({
        detail: 'El servicio de recomendación respondió con un error',
      });
    }
    return (await res.json()) as T;
  }

  recomendar(p: PeticionRecomendar) {
    return this.llamar<ProductoPuntuado[]>('/recomendar', p);
  }

  buscarNecesidad(texto: string, k: number) {
    return this.llamar<ProductoPuntuado[]>('/buscar-necesidad', { texto, k });
  }

  reentrenar() {
    return this.llamar<Record<string, unknown>>('/reentrenar', {}, 300_000);
  }

  evaluacionOffline() {
    return this.llamar<Record<string, unknown>>(
      '/evaluacion-offline',
      {},
      300_000,
    );
  }

  async recargar() {
    await this.llamar('/recargar', {});
  }

  async salud() {
    try {
      await this.llamar('/health', undefined, 3_000);
      return true;
    } catch {
      return false;
    }
  }
}
