import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ValidationContext } from '../domain/validation-context';
import { Policies } from '../domain/policies.interface';
import { Expense } from '../domain/expense.interface';
import { ValidationResult } from '../domain/validation-result.interface';
import { ValidationRule } from '../rules/validation-rule.interface';
import { ValidationRequestDto } from '../dto/validation-request.dto';
import { VALIDATION_RULES } from '../validation.tokens';
import { getZonedNow } from '../config/timezone.config';
import { getDefaultPolicies } from '../config/policies.config';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    @Inject(VALIDATION_RULES) private readonly rules: ValidationRule[],
  ) {}

  async validateExpense(
    payload: ValidationRequestDto,
    now: Date = getZonedNow(),
  ): Promise<ValidationResult> {
    const { gasto, politicas } = payload;
    const policies = politicas ?? getDefaultPolicies();

    if (!policies) {
      throw new Error(
        'No se proporcionaron politicas y DEFAULT_POLICIES no está configurado',
      );
    }

    const montoConvertido = this.convertAmountToBase(gasto, policies);

    const context = new ValidationContext({
      expense: gasto,
      policies,
      montoConvertido,
      now,
    });

    for (const rule of this.rules) {
      try {
        rule.evaluate(context);
      } catch (error) {
        this.logger.error(
          `Error evaluando regla ${rule.name}: ${String(error)}`,
        );
        throw error;
      }
    }

    return context.toResult();
  }

  private convertAmountToBase(expense: Expense, policies: Policies): number {
    if (typeof expense.monto_base === 'number') {
      return expense.monto_base;
    }

    if (expense.moneda_original === policies.moneda_base) {
      return expense.monto_original;
    }

    throw new BadRequestException(
      'monto_base es requerido cuando moneda_original difiere de moneda_base',
    );
  }
}
