import {
  IsArray,
  IsNumber,
  IsObject,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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
  @ValidateNested({ each: true })
  @Type(() => CategoryLimitDto)
  limites_por_categoria: Record<string, CategoryLimitDto>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CostCenterRuleDto)
  reglas_centro_costo: CostCenterRuleDto[];
}
