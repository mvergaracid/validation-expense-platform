import { Body, Controller, Post } from '@nestjs/common';
import { ConvertRequestDto, ConvertResponseDto } from '../dto/convert.dto';
import { ConversionService } from '../services/conversion.service';

@Controller()
export class ConvertController {
  constructor(private readonly service: ConversionService) {}

  @Post('convert')
  async convert(@Body() input: ConvertRequestDto): Promise<ConvertResponseDto> {
    return this.service.convert(input);
  }
}
