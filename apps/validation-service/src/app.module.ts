import { Module } from '@nestjs/common';
import { ValidationModule } from './validation.module';

@Module({
  imports: [ValidationModule],
})
export class AppModule {}
