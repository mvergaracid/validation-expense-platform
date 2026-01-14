import { Injectable } from '@nestjs/common';
import { ValidationRule } from './validation-rule.interface';
import { ValidationContext } from '../domain/validation-context';
import { ValidationStatus } from '../domain/validation-status.enum';
import { ValidationAlertCode } from '../domain/validation-alert-code.enum';

@Injectable()
export class CategoryLimitRule implements ValidationRule {
  readonly name = CategoryLimitRule.name;

  evaluate(context: ValidationContext): void {
    const {
      expense: { categoria },
      policies: { limites_por_categoria },
      montoConvertido,
      monedaBase,
    } = context;

    const limites = limites_por_categoria[categoria];

    if (!limites) {
      context.addSuggestion(this.name, ValidationStatus.APROBADO, {
        codigo: ValidationAlertCode.CONFIG_CATEGORIA,
        mensaje: `No existe configuración de límites para la categoría ${categoria}, se aprueba por omisión.`,
      });
      return;
    }

    const monto = montoConvertido;

    if (monto <= limites.aprobado_hasta) {
      context.addSuggestion(this.name, ValidationStatus.APROBADO);
      return;
    }

    if (monto <= limites.pendiente_hasta) {
      context.addSuggestion(this.name, ValidationStatus.PENDIENTE, {
        codigo: ValidationAlertCode.LIMITE_CATEGORIA,
        mensaje: `Requiere revisión: el monto ${monto} ${monedaBase} supera el umbral automático (${limites.aprobado_hasta}) pero permanece por debajo del máximo (${limites.pendiente_hasta}).`,
      });
      return;
    }

    context.addSuggestion(this.name, ValidationStatus.RECHAZADO, {
      codigo: ValidationAlertCode.LIMITE_CATEGORIA,
      mensaje: `El monto ${monto} ${monedaBase} excede el límite máximo (${limites.pendiente_hasta}).`,
    });
  }
}
