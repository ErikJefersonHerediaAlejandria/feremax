import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leerCsv, trozos } from "./lib.js";
import { fecha, lista } from "./importar-v1.js";

describe("leerCsv", () => {
  it("respeta comillas, comas internas y CRLF", () => {
    const dir = mkdtempSync(join(tmpdir(), "csv-"));
    const ruta = join(dir, "x.csv");
    writeFileSync(ruta, '\uFEFFa,b\r\n1,"hola, mundo"\r\n2,"dice ""sí"""\r\n');
    expect(leerCsv(ruta)).toEqual([
      { a: "1", b: "hola, mundo" },
      { a: "2", b: 'dice "sí"' },
    ]);
  });
});

describe("lista (antecedentes/consecuentes de v1)", () => {
  it.each([
    ['["TUB-001", "ACC-001"]', ["TUB-001", "ACC-001"]],
    ["{TUB-001,ACC-001}", ["TUB-001", "ACC-001"]],
    ["TUB-001|ACC-001", ["TUB-001", "ACC-001"]],
    [["PIN-001"], ["PIN-001"]],
    ["", []],
  ])("%j", (entrada, esperado) => expect(lista(entrada)).toEqual(esperado));
});

describe("fecha", () => {
  it("interpreta un texto sin zona horaria como UTC", () => {
    expect(fecha("2026-10-01 10:00:00")?.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });
  it("respeta la zona horaria explícita y los milisegundos", () => {
    expect(fecha("2026-10-01T10:00:00-05:00")?.toISOString()).toBe("2026-10-01T15:00:00.000Z");
    expect(fecha(1759330800000)?.toISOString()).toBe("2025-10-01T15:00:00.000Z");
  });
  it("devuelve null si está vacío", () => expect(fecha("")).toBeNull());
});

describe("trozos", () => {
  it("parte un arreglo en lotes", () => expect(trozos([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
});
