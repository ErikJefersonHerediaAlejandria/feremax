import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const MODOS = ['CONV', 'ML'] as const;
const aLista = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

export class ProductosQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) categoria?:
    string | null;
}

export class KQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  k?: number | null;
}

export class RecomendarQuery extends KQuery {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(32) sku!: string;
}

export class RecomendarClienteQuery extends KQuery {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(aLista)
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  skus?: string[];
}

export class BuscarNecesidadDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) texto!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(52) k?:
    number | null;
}

export class RecomendarCarritoDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  skus!: string[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(20) k?:
    number | null;
}

export class EventoDto {
  @ApiProperty() @IsString() @MaxLength(64) id_sesion!: string;
  @ApiProperty() @IsString() @MaxLength(64) codigo_cliente!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) escenario?:
    string | null;
  @ApiProperty({ enum: MODOS }) @IsIn(MODOS) condicion!: (typeof MODOS)[number];
  @ApiProperty({ example: 'CONSULTA' })
  @IsString()
  @Matches(/^[A-Z_]{3,40}$/, {
    message: 'tipo_evento debe estar en MAYÚSCULAS_CON_GUIONES',
  })
  tipo_evento!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  texto_consulta?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) sku?:
    string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  posicion_recom?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) origen?:
    string | null;
  @ApiProperty({ description: 'Milisegundos desde epoch' })
  @IsInt()
  @Min(0)
  timestamp!: number;
}

export class ConfirmarItemDto {
  @ApiProperty() @IsString() @MaxLength(32) sku!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(999) cantidad!: number;
  @ApiProperty({
    description: 'Se ignora: el servidor usa el precio del catálogo',
  })
  @IsNumber()
  precio!: number;
  @ApiProperty() @IsString() @MaxLength(32) origen!: string;
}

export class ConfirmarCarritoDto {
  @ApiProperty() @IsString() @MaxLength(64) id_sesion!: string;
  @ApiProperty() @IsString() @MaxLength(64) codigo_cliente!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) escenario?:
    string | null;
  @ApiProperty({ enum: MODOS }) @IsIn(MODOS) condicion!: (typeof MODOS)[number];
  @ApiProperty() @IsInt() @Min(0) timestamp!: number;
  @ApiProperty({ type: [ConfirmarItemDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ConfirmarItemDto)
  items!: ConfirmarItemDto[];
  @ApiProperty({ description: 'Se ignora: el servidor recalcula el total' })
  @IsNumber()
  total!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) entrega?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) pago?:
    string | null;
}
