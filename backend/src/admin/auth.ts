import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request } from 'express';
import { PrismaService } from '../comun/prisma.service.js';

export const COOKIE_ADMIN = 'ferremax_admin';
export const DURACION_SESION_S = 8 * 60 * 60;
const NO_AUTENTICADO = { detail: 'Se requiere iniciar sesión en el panel' };

export interface Admin {
  sub: number;
  username: string;
}

export function opcionesCookie(): CookieOptions {
  return {
    httpOnly: true,
    // Secure siempre, salvo que se desactive explícitamente (p. ej. pruebas por http en otra máquina).
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_SESION_S * 1000,
  };
}

@Injectable()
export class AuthService {
  // Hash real de una contraseña aleatoria: si el usuario no existe, verificar cuesta lo mismo que si existe.
  private readonly hashFicticio = argon2.hash(randomBytes(32).toString('hex'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string): Promise<string> {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    // Se verifica igualmente con un hash ficticio para no revelar por tiempo si el usuario existe.
    const hash = admin?.password_hash ?? (await this.hashFicticio);
    const ok = await argon2.verify(hash, password).catch(() => false);
    if (!admin || !ok)
      throw new UnauthorizedException({
        detail: 'Usuario o contraseña incorrectos',
      });
    return this.jwt.signAsync({
      sub: admin.id,
      username: admin.username,
    } satisfies Admin);
  }

  /** Admin autenticado por cookie httpOnly (o `Authorization: Bearer`, para clientes no navegador), o null. */
  async desde(req: Request): Promise<Admin | null> {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const token = cookies?.[COOKIE_ADMIN] ?? bearer;
    if (!token) return null;
    try {
      const datos = await this.jwt.verifyAsync<Admin>(token);
      return { sub: datos.sub, username: datos.username };
    } catch {
      return null;
    }
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: Admin }>();
    const admin = await this.auth.desde(req);
    if (!admin) throw new UnauthorizedException(NO_AUTENTICADO);
    req.admin = admin;
    return true;
  }
}
