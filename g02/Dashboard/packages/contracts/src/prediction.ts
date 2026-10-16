import { z } from 'zod';

import {
  IsoTimestampSchema,
  OpportunityTierSchema,
  ProviderStateSchema,
  TreatmentLineSchema,
  YearMonthSchema,
} from './common.js';

const nonEmptyIdentifierSchema = z.string().min(1);
const demandVolumeSchema = z.number().finite().nonnegative();

export const PredictionRecordSchema = z
  .object({
    predictionId: nonEmptyIdentifierSchema,
    operatorId: z.string(),
    operatorName: z.string().nullable().optional(),
    treatmentLine: TreatmentLineSchema,
    providerState: ProviderStateSchema,
    referenceMonth: YearMonthSchema,
    forecastMonth: YearMonthSchema,
    predictedDemandVolume: demandVolumeSchema,
    observedDemandVolume: demandVolumeSchema.nullable().optional(),
    opportunityTier: OpportunityTierSchema,
    targetMeasured: z.boolean().optional(),
    isStructuralZero: z.boolean().optional(),
    hasRecentHistory: z.boolean().optional(),
    modelId: nonEmptyIdentifierSchema,
    modelVersion: nonEmptyIdentifierSchema,
    generatedAt: IsoTimestampSchema,
  })
  .strict();

export type PredictionRecord = z.infer<typeof PredictionRecordSchema>;
