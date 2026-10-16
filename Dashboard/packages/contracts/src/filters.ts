import { z } from 'zod';

import {
  OpportunityTierSchema,
  ProviderStateSchema,
  TreatmentLineSchema,
  YearMonthSchema,
} from './common.js';

const uniqueArray = <T extends z.ZodType>(itemSchema: T) =>
  z.array(itemSchema).superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: 'custom',
        message: 'Filter values must not contain duplicates.',
      });
    }
  });

export const DashboardFiltersSchema = z
  .object({
    operatorIds: uniqueArray(z.string().min(1)).optional(),
    treatmentLines: uniqueArray(TreatmentLineSchema).optional(),
    providerStates: uniqueArray(ProviderStateSchema).optional(),
    forecastMonths: uniqueArray(YearMonthSchema).optional(),
    opportunityTiers: uniqueArray(OpportunityTierSchema).optional(),
  })
  .strict();

export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>;
