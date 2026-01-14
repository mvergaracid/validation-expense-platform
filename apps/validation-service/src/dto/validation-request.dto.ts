import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { ExpenseDto } from './expense.dto';
import { PoliciesDto } from './policies.dto';

export class ValidationRequestDto {
  @ValidateNested()
  @Type(() => ExpenseDto)
  gasto: ExpenseDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PoliciesDto)
  politicas?: PoliciesDto;
}
