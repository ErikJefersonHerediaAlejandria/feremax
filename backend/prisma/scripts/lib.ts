import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

/** Opciones de conexión comunes. La sesión se fija en UTC: el adaptador envía los timestamps sin zona horaria. */
export function opcionesPg(connectionString: string | undefined) {
  return { connectionString, options: "-c timezone=UTC" };
}

export function crearPrisma(): PrismaClient {
  const adapter = new PrismaPg(opcionesPg(process.env.DIRECT_URL ?? process.env.DATABASE_URL));
  return new PrismaClient({ adapter });
}

/** Parser CSV mínimo (RFC 4180: comillas dobles, comas y saltos de línea dentro de comillas). */
export function leerCsv(ruta: string): Record<string, string>[] {
  const texto = readFileSync(ruta, "utf8").replace(/^\uFEFF/, "");
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((v) => v !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  const [cabecera, ...resto] = filas;
  return resto.map((f) => Object.fromEntries(cabecera.map((h, i) => [h.trim(), f[i] ?? ""])));
}

export function trozos<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
