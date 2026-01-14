import { ValidationStatus } from './validation-status.enum';

export interface ValidationSuggestion {
  regla: string;
  estado: ValidationStatus;
}

export interface ValidationAlert {
  codigo: string;
  mensaje: string;
}

export interface ValidationResult {
  gasto_id: string;
  status: ValidationStatus;
  alertas: ValidationAlert[];
  sugerencias: ValidationSuggestion[];
  montoConvertido: number;
  monedaBase: string;
}

export interface ValidationResponse {
  gasto_id: string;
  status: ValidationStatus;
  alertas: ValidationAlert[];
}
