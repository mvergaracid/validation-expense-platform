import { Body, Controller, Post } from '@nestjs/common';
import { ValidationService } from '../services/validation.service';
import { ValidationRequestDto } from '../dto/validation-request.dto';
import { ValidationResult } from '../domain/validation-result.interface';

@Controller('validations')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Post()
  validateExpense(
    @Body() payload: ValidationRequestDto,
  ): Promise<ValidationResult> {
    return this.validationService.validateExpense(payload);
  }
}
