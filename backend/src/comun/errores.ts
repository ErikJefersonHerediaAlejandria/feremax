import {
  ArgumentMetadata,
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';

/** Detalle de validación con la misma forma que FastAPI (v1): `{detail: [{type, loc, msg}]}`. */
export function errorDeValidacion(errores: ValidationError[], origen = 'body') {
  const detalle: { type: string; loc: (string | number)[]; msg: string }[] = [];
  const recorrer = (e: ValidationError, ruta: (string | number)[]) => {
    const loc = [
      ...ruta,
      /^\d+$/.test(e.property) ? Number(e.property) : e.property,
    ];
    for (const [tipo, msg] of Object.entries(e.constraints ?? {})) {
      detalle.push({
        type:
          tipo === 'whitelistValidation' ? 'extra_forbidden' : 'value_error',
        loc,
        msg,
      });
    }
    for (const hijo of e.children ?? []) recorrer(hijo, loc);
  };
  for (const e of errores) recorrer(e, [origen]);
  return new UnprocessableEntityException({ detail: detalle });
}

/** Todas las respuestas de error usan `{detail: …}`, como el API v1. */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly log = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof ThrottlerException) {
      res
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .json({ detail: 'Demasiadas solicitudes, intenta en un momento' });
      return;
    }
    if (error instanceof HttpException) {
      const cuerpo = error.getResponse();
      const detail =
        typeof cuerpo === 'object' && cuerpo !== null && 'detail' in cuerpo
          ? (cuerpo as { detail: unknown }).detail
          : error.getStatus() === HttpStatus.NOT_FOUND &&
              /^Cannot (GET|POST|PUT|DELETE|PATCH)/.test(error.message)
            ? 'Not Found'
            : error.message;
      res.status(error.getStatus()).json({ detail });
      return;
    }
    this.log.error(error instanceof Error ? error.stack : String(error));
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ detail: 'Error interno del servidor' });
  }
}

class ErroresPendientes extends Error {
  constructor(readonly errores: ValidationError[]) {
    super('validación');
  }
}

/** ValidationPipe que informa el origen (`body`, `query`, `path`) en `loc`, como FastAPI. */
export class PipeValidacion extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (e) => new ErroresPendientes(e),
    });
  }

  override async transform(valor: unknown, meta: ArgumentMetadata) {
    try {
      return (await super.transform(valor, meta)) as unknown;
    } catch (e) {
      if (e instanceof ErroresPendientes)
        throw errorDeValidacion(
          e.errores,
          meta.type === 'param' ? 'path' : meta.type,
        );
      throw e;
    }
  }
}
