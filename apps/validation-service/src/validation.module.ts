import { Module } from '@nestjs/common';
import { ValidationController } from './controllers/validation.controller';
import { ValidationService } from './services/validation.service';
import { VALIDATION_RULES } from './validation.tokens';
import { ExpenseAgeRule } from './rules/expense-age.rule';
import { CategoryLimitRule } from './rules/category-limit.rule';
import { CostCenterRule } from './rules/cost-center.rule';

@Module({
  controllers: [ValidationController],
  providers: [
    ValidationService,
    ExpenseAgeRule,
    CategoryLimitRule,
    CostCenterRule,
    {
      provide: VALIDATION_RULES,
      useFactory: (
        ageRule: ExpenseAgeRule,
        categoryRule: CategoryLimitRule,
        costCenterRule: CostCenterRule,
      ) => [ageRule, categoryRule, costCenterRule],
      inject: [ExpenseAgeRule, CategoryLimitRule, CostCenterRule],
    },
  ],
})
export class ValidationModule {}
