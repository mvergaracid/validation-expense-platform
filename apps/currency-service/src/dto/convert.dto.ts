import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConvertItemDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  monto_original!: number;

  @IsString()
  moneda_original!: string;

  @IsOptional()
  @IsString()
  moneda_base?: string;

  @IsOptional()
  @IsString()
  fecha?: string;
}

export class ConvertRequestDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConvertItemDto)
  montos?: ConvertItemDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  monto_original?: number;

  @IsOptional()
  @IsString()
  moneda_original?: string;

  @IsOptional()
  @IsString()
  moneda_base?: string;

  @IsOptional()
  @IsString()
  fecha?: string;
}

export interface ConvertResponseItemDto {
  monto_original: number;
  moneda_original: string;
  moneda_base: string;
  monto_convertido: number;
  tipo_cambio: number;
  rate_source?: 'cache' | 'api' | 'stale_cache';
}

export class ConvertResponseDto {
  @IsArray()
  results!: ConvertResponseItemDto[];
}
