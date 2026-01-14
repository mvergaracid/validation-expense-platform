import { Body, Controller, Post } from '@nestjs/common';
import { ValidationService } from '../services/validation.service';
import { ValidationRequestDto } from '../dto/validation-request.dto';
import { ValidationResponse } from '../domain/validation-result.interface';

@Controller('validations')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Post()
  validateExpense(
    @Body() payload: ValidationRequestDto,
  ): Promise<ValidationResponse> {
    return this.validationService.validateExpense(payload).then(({ gasto_id, status, alertas }) => ({
      gasto_id,
      status,
      alertas,
    }));
  }
}
