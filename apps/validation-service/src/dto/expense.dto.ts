import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';
import { Expense } from '../domain/expense.interface';

export class ExpenseDto implements Expense {
  @IsString()
  id: string;

  @IsString()
  empleado_id: string;

  @IsPositive()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  monto_original: number;

  @IsString()
  moneda_original: string;

  @IsOptional()
  @IsPositive()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  monto_base?: number;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener el formato yyyy-mm-dd',
  })
  fecha: string;

  @IsString()
  categoria: string;

  @IsString()
  cost_center: string;

}
