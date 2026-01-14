import { ValidationContext } from '../domain/validation-context';

export interface ValidationRule {
  readonly name: string;
  evaluate(context: ValidationContext): void;
}
