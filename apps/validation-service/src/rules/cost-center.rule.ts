import { Injectable } from '@nestjs/common';
import { ValidationRule } from './validation-rule.interface';
import { ValidationContext } from '../domain/validation-context';
import { ValidationStatus } from '../domain/validation-status.enum';
import { ValidationAlertCode } from '../domain/validation-alert-code.enum';

@Injectable()
export class CostCenterRule implements ValidationRule {
  readonly name = CostCenterRule.name;

  evaluate(context: ValidationContext): void {
    const {
      expense: { cost_center, categoria },
      policies: { reglas_centro_costo },
    } = context;

    const prohibida = reglas_centro_costo.find(
      ({ cost_center: policyCostCenter, categoria_prohibida }) =>
        policyCostCenter === cost_center &&
        categoria_prohibida === categoria,
    );

    if (!prohibida) {
      context.addSuggestion(this.name, ValidationStatus.APROBADO);
      return;
    }

    context.addSuggestion(this.name, ValidationStatus.RECHAZADO, {
      codigo: ValidationAlertCode.POLITICA_CENTRO_COSTO,
      mensaje: `El C.C. '${cost_center}' no puede reportar '${categoria}'.`,
    });
  }
}
