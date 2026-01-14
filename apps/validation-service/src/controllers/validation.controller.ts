import { Body, Controller, Post } from '@nestjs/common';
import { ValidationService } from '../services/validation.service';
import { ValidationRequestDto } from '../dto/validation-request.dto';
import { ValidationResponse } from '../domain/validation-result.interface';

@Controller('validations')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Post()
  async validateExpense(
    @Body() payload: ValidationRequestDto,
  ): Promise<ValidationResponse> {
    const { gasto_id, status, alertas } = await this.validationService.validateExpense(payload);
    return {
      gasto_id,
      status,
      alertas,
    };
  }
}
