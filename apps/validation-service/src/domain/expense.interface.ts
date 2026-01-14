export interface Expense {
  id: string;
  fecha: string;
  monto_original: number;
  moneda_original: string;
  monto_base?: number;
  categoria: string;
  cost_center: string;
  empleado_id: string;
}
