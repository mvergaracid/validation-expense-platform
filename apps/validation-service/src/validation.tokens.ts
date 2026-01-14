import { InjectionToken } from '@nestjs/common';
import { ValidationRule } from './rules/validation-rule.interface';

export const VALIDATION_RULES: InjectionToken<ValidationRule[]> = Symbol(
  'VALIDATION_RULES',
);
