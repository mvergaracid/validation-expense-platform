import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseEntity } from './expense.entity';
import { createTypeOrmOptions } from './orm.config';
import { ExpenseRepository } from './expense.repository';
import { JobRunEntity } from './job-run.entity';
import { JobRunStageEntity } from './job-run-stage.entity';
import { JobRunRepository } from './job-run.repository';
import { ValidationPolicyEntity } from './validation-policy.entity';
import { ValidationPolicyRepository } from './validation-policy.repository';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmOptions(),
    }),
    TypeOrmModule.forFeature([ExpenseEntity, JobRunEntity, JobRunStageEntity, ValidationPolicyEntity]),
  ],
  providers: [ExpenseRepository, JobRunRepository, ValidationPolicyRepository],
  exports: [ExpenseRepository, JobRunRepository, ValidationPolicyRepository],
})
export class PersistenceModule {}
