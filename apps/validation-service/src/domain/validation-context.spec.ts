import { ValidationContext } from './validation-context';
import { Expense } from './expense.interface';
import { Policies } from './policies.interface';
import { ValidationStatus } from './validation-status.enum';

describe('ValidationContext', () => {
  const basePolicies: Policies = {
    moneda_base: 'USD',
    limite_antiguedad: {
      pendiente_dias: 30,
      rechazado_dias: 60,
    },
    limites_por_categoria: {
      food: {
        aprobado_hasta: 100,
        pendiente_hasta: 150,
      },
    },
    reglas_centro_costo: [],
  };

  const baseExpense: Expense = {
    id: 'expense-1',
    fecha: '2025-01-01',
    monto_original: 80,
    moneda_original: 'USD',
    categoria: 'food',
    cost_center: 'growth',
    empleado_id: 'emp-1',
  };

  it('throws when expense date is invalid', () => {
    const invalidExpense: Expense = {
      ...baseExpense,
      fecha: '2025-13-40',
    };

    expect(
      () =>
        new ValidationContext({
          expense: invalidExpense,
          policies: basePolicies,
          montoConvertido: invalidExpense.monto_original,
        }),
    ).toThrow('Fecha de gasto inválida');
  });

  it('produce el resultado agregando alertas y estado final', () => {
    const context = new ValidationContext({
      expense: baseExpense,
      policies: basePolicies,
      montoConvertido: 120,
      now: new Date('2025-01-10T00:00:00Z'),
    });

    context.addAlert('alerta manual');
    context.addSuggestion(
      'RulePendiente',
      ValidationStatus.PENDIENTE,
      'alerta pendiente',
    );
    context.addSuggestion('RuleRechazo', ValidationStatus.RECHAZADO);

    const result = context.toResult();

    expect(result.estadoFinal).toBe(ValidationStatus.RECHAZADO);
    expect(result.alertas).toEqual(['alerta manual', 'alerta pendiente']);
    expect(result.sugerencias).toEqual([
      { regla: 'RulePendiente', estado: ValidationStatus.PENDIENTE },
      { regla: 'RuleRechazo', estado: ValidationStatus.RECHAZADO },
    ]);
    expect(result.montoConvertido).toBe(120);
    expect(result.monedaBase).toBe(basePolicies.moneda_base);
  });
});
