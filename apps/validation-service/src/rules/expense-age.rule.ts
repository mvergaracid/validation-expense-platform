import { Injectable } from '@nestjs/common';
import { ValidationRule } from './validation-rule.interface';
import { ValidationContext } from '../domain/validation-context';
import { ValidationStatus } from '../domain/validation-status.enum';

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
        `Gasto con ${daysSinceExpense} días supera la ventana de aprobación automática (${pendiente_dias} días).`,
      );
      return;
    }

    context.addSuggestion(
      this.name,
      ValidationStatus.RECHAZADO,
      `Gasto con ${daysSinceExpense} días excede el límite máximo de ${rechazado_dias} días.`,
    );
  }
}
