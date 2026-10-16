import { z } from 'zod';

import {
  OpportunityTierSchema,
  ProviderStateSchema,
  TreatmentLineSchema,
  YearMonthSchema,
} from './common.js';

const nonNegativeCountSchema = z.number().int().nonnegative();
const demandVolumeSchema = z.number().finite().nonnegative();
const finiteNullableSchema = z.number().finite().nullable();

const uniquePrimitiveArray = <T extends z.ZodType>(itemSchema: T) =>
  z.array(itemSchema).superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: 'custom',
        message: 'Values must be unique.',
      });
    }
  });

export const DashboardSummarySchema = z
  .object({
    totalEstimatedDemandVolume: demandVolumeSchema,
    predictionCount: nonNegativeCountSchema,
    operatorCount: nonNegativeCountSchema,
    highOpportunityRecordCount: nonNegativeCountSchema,
  })
  .strict();

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

export const DashboardDistributionDimensionSchema = z.enum([
  'provider_state',
  'treatment_line',
  'opportunity_tier',
  'forecast_month',
]);

export type DashboardDistributionDimension = z.infer<
  typeof DashboardDistributionDimensionSchema
>;

export const DashboardDistributionItemSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    estimatedDemandVolume: demandVolumeSchema,
    predictionCount: nonNegativeCountSchema,
  })
  .strict();

export type DashboardDistributionItem = z.infer<typeof DashboardDistributionItemSchema>;

export const DashboardOperatorOptionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable(),
  })
  .strict();

export type DashboardOperatorOption = z.infer<typeof DashboardOperatorOptionSchema>;

const uniqueOperatorOptionsSchema = z
  .array(DashboardOperatorOptionSchema)
  .superRefine((operators, context) => {
    const operatorIds = operators.map(({ id }) => id);

    if (new Set(operatorIds).size !== operatorIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Operator IDs must be unique.',
      });
    }
  });

export const DashboardFilterOptionsSchema = z
  .object({
    operators: uniqueOperatorOptionsSchema,
    treatmentLines: uniquePrimitiveArray(TreatmentLineSchema),
    providerStates: uniquePrimitiveArray(ProviderStateSchema),
    forecastMonths: uniquePrimitiveArray(YearMonthSchema),
    opportunityTiers: uniquePrimitiveArray(OpportunityTierSchema),
  })
  .strict();

export type DashboardFilterOptions = z.infer<typeof DashboardFilterOptionsSchema>;

export const BacktestSliceSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    rowCount: nonNegativeCountSchema,
    observedRowCount: nonNegativeCountSchema,
    predictedTotal: demandVolumeSchema,
    observedTotal: demandVolumeSchema,
    mae: demandVolumeSchema.nullable(),
    rmse: demandVolumeSchema.nullable(),
    r2: finiteNullableSchema,
  })
  .strict();

export type BacktestSlice = z.infer<typeof BacktestSliceSchema>;

export const DashboardBacktestSchema = z
  .object({
    rowCount: nonNegativeCountSchema,
    observedRowCount: nonNegativeCountSchema,
    predictedTotal: demandVolumeSchema,
    observedTotal: demandVolumeSchema,
    mae: demandVolumeSchema.nullable(),
    rmse: demandVolumeSchema.nullable(),
    r2: finiteNullableSchema,
    byForecastMonth: z.array(BacktestSliceSchema),
    byTreatmentLine: z.array(BacktestSliceSchema),
    byProviderState: z.array(BacktestSliceSchema),
  })
  .strict();

export type DashboardBacktest = z.infer<typeof DashboardBacktestSchema>;
