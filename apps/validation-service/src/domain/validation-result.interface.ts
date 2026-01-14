import { ValidationStatus } from './validation-status.enum';

export interface ValidationSuggestion {
  regla: string;
  estado: ValidationStatus;
}

export interface ValidationResult {
  estadoFinal: ValidationStatus;
  alertas: string[];
  sugerencias: ValidationSuggestion[];
  montoConvertido: number;
  monedaBase: string;
}
