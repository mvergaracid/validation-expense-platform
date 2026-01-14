import { Injectable } from '@nestjs/common';
import { ValidationRule } from './validation-rule.interface';
import { ValidationContext } from '../domain/validation-context';
import { ValidationStatus } from '../domain/validation-status.enum';
import { ValidationAlertCode } from '../domain/validation-alert-code.enum';

@Injectable()
export class ExpenseAgeRule implements ValidationRule {
  readonly name = ExpenseAgeRule.name;

  evaluate(context: ValidationContext): void {
    const { daysSinceExpense, policies } = context;
    const { limite_antiguedad: { pendiente_dias, rechazado_dias } } = policies;

    if (daysSinceExpense < pendiente_dias) {
      context.addSuggestion(this.name, ValidationStatus.APROBADO);
      return;
    }

    if (daysSinceExpense < rechazado_dias) {
      context.addSuggestion(
        this.name,
        ValidationStatus.PENDIENTE,
        {
          codigo: ValidationAlertCode.LIMITE_ANTIGUEDAD,
          mensaje: `Gasto excede los ${pendiente_dias} días. Requiere revisión.`,
        },
      );
      return;
    }

    context.addSuggestion(
      this.name,
      ValidationStatus.RECHAZADO,
      {
        codigo: ValidationAlertCode.LIMITE_ANTIGUEDAD,
        mensaje: `Gasto excede los ${rechazado_dias} días.`,
      },
    );
  }
}
