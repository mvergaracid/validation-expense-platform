import { Module } from '@nestjs/common';
import { CurrencyModule } from './currency.module';

@Module({
  imports: [CurrencyModule],
})
export class AppModule {}
