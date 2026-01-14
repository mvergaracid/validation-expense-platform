import { createHash } from 'crypto';
import { ExpenseCreatedEvent } from '../handlers/expense-events.handler';

export class FingerprintService {
  build(event: ExpenseCreatedEvent): string {
    const canonical = {
      fecha: event.fecha,
      monto_original: event.monto_original,
      moneda_original: event.moneda_original,
    };

    const raw = JSON.stringify(canonical);
    return createHash('sha256').update(raw).digest('hex');
  }
}
