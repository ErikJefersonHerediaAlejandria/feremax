import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MODOS } from '../tienda/dto.js';

export const VARIANTES_ML = ['COMPLETO', 'REGLAS'] as const;

export class LoginDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) username!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) password!: string;
}

export class ConfiguracionDto {
  @ApiProperty({ enum: MODOS })
  @IsIn(MODOS)
  modo_activo!: (typeof MODOS)[number];
  @ApiProperty() @IsInt() @Min(1) @Max(20) k!: number;
  @ApiProperty() @IsNumber() @Min(0.001) @Max(1) soporte_min!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(1) confianza_min!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(100) lift_min!: number;
  @ApiProperty({ description: '1 = neutro' })
  @IsNumber()
  @Min(0)
  @Max(5)
  peso_contenido!: number;
  @ApiPropertyOptional({ enum: VARIANTES_ML })
  @IsOptional()
  @IsIn(VARIANTES_ML)
  variante_ml?: string | null;
}

export class ReglasQuery {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  vigentes?: boolean;
}

export class IniciarSesionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) id_sesion?:
    string | null;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  codigo_cliente!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) escenario!: string;
  @ApiProperty({ enum: MODOS }) @IsIn(MODOS) condicion!: (typeof MODOS)[number];
  @ApiProperty({ description: 'Orden de contrabalanceo (A/B o número)' })
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : value))
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  orden!: string;
}

export class FinalizarSesionDto {
  @ApiProperty() @IsString() @MaxLength(40) id_sesion!: string;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  valida?: boolean = true;
}

export class EventosQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() id_sesion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() codigo_cliente?: string;
  @ApiPropertyOptional({ enum: MODOS })
  @IsOptional()
  @IsIn(MODOS)
  condicion?: (typeof MODOS)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() tipo_evento?: string;
  @ApiPropertyOptional({ default: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50_000)
  limite?: number = 5000;
}
