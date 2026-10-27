import { Injectable, NotFoundException } from '@nestjs/common';
import { productoV1 } from '../comun/formato.js';
import { PrismaService } from '../comun/prisma.service.js';

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Productos activos ordenados del más al menos vendido (nº de boletas), como en v1. */
  async productos(categoria?: string | null) {
    const [productos, ventas] = await Promise.all([
      this.prisma.producto.findMany({
        where: { activo: true, ...(categoria ? { categoria } : {}) },
      }),
      this.prisma.boletaItem.groupBy({ by: ['sku'], _count: { _all: true } }),
    ]);
    const vendidos = new Map(ventas.map((v) => [v.sku, v._count._all]));
    return productos
      .sort(
        (a, b) =>
          (vendidos.get(b.sku) ?? 0) - (vendidos.get(a.sku) ?? 0) ||
          a.sku.localeCompare(b.sku),
      )
      .map(productoV1);
  }

  async producto(sku: string) {
    const p = await this.prisma.producto.findUnique({ where: { sku } });
    if (!p || !p.activo)
      throw new NotFoundException({ detail: 'Producto no encontrado' });
    return p;
  }

  async categorias() {
    const filas = await this.prisma.producto.findMany({
      where: { activo: true, categoria: { not: null } },
      select: { categoria: true, subcategoria: true },
      distinct: ['categoria', 'subcategoria'],
    });
    const mapa = new Map<string, Set<string>>();
    for (const f of filas) {
      const subs = mapa.get(f.categoria!) ?? new Set<string>();
      if (f.subcategoria) subs.add(f.subcategoria);
      mapa.set(f.categoria!, subs);
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([categoria, subs]) => ({
        categoria,
        subcategorias: [...subs].sort((a, b) => a.localeCompare(b, 'es')),
      }));
  }
}
