import { Module } from '@nestjs/common';
import { IngestorModule } from './ingestor.module';

@Module({
  imports: [IngestorModule],
})
export class AppModule {}
