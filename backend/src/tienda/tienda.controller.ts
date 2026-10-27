import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { CABECERA_SESION, ContextoService } from '../comun/contexto.service.js';
import { PrismaService } from '../comun/prisma.service.js';
import { Recommender } from '../comun/recommender.client.js';
import { CatalogoService } from './catalogo.service.js';
import { productoV1 } from '../comun/formato.js';
import {
  BuscarNecesidadDto,
  ProductosQuery,
  RecomendarCarritoDto,
  RecomendarClienteQuery,
  RecomendarQuery,
} from './dto.js';

const K_BUSQUEDA = 12;

@ApiTags('tienda')
@Controller('api')
export class TiendaController {
  constructor(
    private readonly catalogo: CatalogoService,
    private readonly contexto: ContextoService,
    private readonly recommender: Recommender,
    private readonly prisma: PrismaService,
  ) {}

  @Get('productos')
  productos(@Query() q: ProductosQuery) {
    return this.catalogo.productos(q.categoria);
  }

  @Get('productos/:sku')
  async producto(@Param('sku') sku: string) {
    return productoV1(await this.catalogo.producto(sku));
  }

  @Get('categorias')
  categorias() {
    return this.catalogo.categorias();
  }

  @Post('buscar-necesidad')
  @HttpCode(200)
  buscarNecesidad(@Body() dto: BuscarNecesidadDto) {
    return this.recommender.buscarNecesidad(dto.texto, dto.k ?? K_BUSQUEDA);
  }

  @Get('recomendar')
  @ApiHeader({ name: CABECERA_SESION, required: false })
  async recomendar(
    @Query() q: RecomendarQuery,
    @Headers(CABECERA_SESION) token?: string,
  ) {
    await this.catalogo.producto(q.sku);
    const ctx = await this.contexto.resolver(token);
    return this.recommender.recomendar({
      skus: [q.sku],
      k: q.k ?? ctx.config.k,
      modo: ctx.condicion,
    });
  }

  @Post('recomendar/carrito')
  @HttpCode(200)
  @ApiHeader({ name: CABECERA_SESION, required: false })
  async recomendarCarrito(
    @Body() dto: RecomendarCarritoDto,
    @Headers(CABECERA_SESION) token?: string,
  ) {
    const ctx = await this.contexto.resolver(token);
    return this.recommender.recomendar({
      skus: dto.skus,
      k: dto.k ?? ctx.config.k,
      modo: ctx.condicion,
    });
  }

  /**
   * B = historial del cliente ∪ carrito. El historial es dato personal: solo se usa si la petición trae el token
   * de la sesión de evaluación activa de ESE cliente. La respuesta nunca incluye el historial.
   */
  @Get('recomendar/cliente/:codigo')
  @ApiHeader({ name: CABECERA_SESION, required: false })
  async recomendarCliente(
    @Param('codigo') codigo: string,
    @Query() q: RecomendarClienteQuery,
    @Headers(CABECERA_SESION) token?: string,
  ) {
    const ctx = await this.contexto.resolver(token);
    const autorizado = ctx.sesion?.codigo_cliente === codigo;
    const conHistorial =
      autorizado &&
      (await this.prisma.boleta.count({ where: { cliente_codigo: codigo } })) >
        0;
    const resultados = await this.recommender.recomendar({
      skus: q.skus ?? [],
      k: q.k ?? ctx.config.k,
      modo: ctx.condicion,
      codigo_cliente: conHistorial ? codigo : null,
    });
    return {
      base: conHistorial ? 'HISTORIAL_Y_CARRITO' : 'SIN_HISTORIAL',
      resultados,
    };
  }
}
