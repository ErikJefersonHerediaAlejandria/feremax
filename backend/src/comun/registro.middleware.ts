import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Registro de peticiones sin datos personales: método, plantilla de ruta (sin query ni parámetros, que pueden
 * llevar códigos de cliente), estado y duración. Nunca se registran cuerpos, cabeceras ni cookies.
 */
@Injectable()
export class RegistroMiddleware implements NestMiddleware {
  private readonly log = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const inicio = performance.now();
    res.on('finish', () => {
      const ruta = (req.route as { path?: unknown } | undefined)?.path;
      const plantilla =
        typeof ruta === 'string' ? req.baseUrl + ruta : 'sin-ruta';
      this.log.log(
        `${req.method} ${plantilla} ${res.statusCode} ${Math.round(performance.now() - inicio)}ms`,
      );
    });
    next();
  }
}
