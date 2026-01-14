export interface AgePolicy {
  pendiente_dias: number;
  rechazado_dias: number;
}

export interface CategoryLimit {
  aprobado_hasta: number;
  pendiente_hasta: number;
}

export interface CostCenterRuleConfig {
  cost_center: string;
  categoria_prohibida: string;
}

export interface Policies {
  moneda_base: string;
  limite_antiguedad: AgePolicy;
  limites_por_categoria: Record<string, CategoryLimit>;
  reglas_centro_costo: CostCenterRuleConfig[];
}
