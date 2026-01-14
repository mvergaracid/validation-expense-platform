import { BadRequestException } from '@nestjs/common';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsPositive,
  IsString,
  ValidateNested,
  validateSync,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  AgePolicy,
  CategoryLimit,
  CostCenterRuleConfig,
  Policies,
} from '../domain/policies.interface';

class AgePolicyDto implements AgePolicy {
  @IsPositive()
  pendiente_dias: number;

  @IsPositive()
  rechazado_dias: number;
}

class CategoryLimitDto implements CategoryLimit {
  @IsPositive()
  aprobado_hasta: number;

  @IsPositive()
  pendiente_hasta: number;
}

class CostCenterRuleDto implements CostCenterRuleConfig {
  @IsString()
  cost_center: string;

  @IsString()
  categoria_prohibida: string;
}

export class PoliciesDto implements Policies {
  @IsString()
  moneda_base: string;

  @ValidateNested()
  @Type(() => AgePolicyDto)
  limite_antiguedad: AgePolicyDto;

  @IsObject()
  @Transform(({ value }) => transformCategoryLimits(value))
  limites_por_categoria: Record<string, CategoryLimitDto>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CostCenterRuleDto)
  reglas_centro_costo: CostCenterRuleDto[];
}

const transformCategoryLimits = (
  raw: unknown,
): Record<string, CategoryLimitDto> => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return Object.entries(raw as Record<string, unknown>).reduce(
    (acc, [key, value]) => {
      acc[key] = plainToInstance(CategoryLimitDto, value);
      return acc;
    },
    {} as Record<string, CategoryLimitDto>,
  );
};
