import { z } from 'zod';

export const ModelAlgorithmSchema = z.enum([
  'decision_tree',
  'linear_regression',
  'random_forest',
  'ridge',
  'lasso',
  'elasticnet',
  'seasonal_naive',
  'group_mean',
]);

export type ModelAlgorithm = z.infer<typeof ModelAlgorithmSchema>;

export const ModelStatusSchema = z.enum(['candidate', 'selected', 'archived']);

export type ModelStatus = z.infer<typeof ModelStatusSchema>;

export const OpportunityTierSchema = z.enum(['low', 'medium', 'high']);

export type OpportunityTier = z.infer<typeof OpportunityTierSchema>;

export const TreatmentLineSchema = z.enum([
  'staging',
  'neoadjuvant',
  'adjuvant',
  'advanced',
  'unknown',
]);

export type TreatmentLine = z.infer<typeof TreatmentLineSchema>;

export const ProviderStateSchema = z.enum(['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO']);

export type ProviderState = z.infer<typeof ProviderStateSchema>;

export const YearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must use the YYYY-MM format.');

export type YearMonth = z.infer<typeof YearMonthSchema>;

export const IsoTimestampSchema = z.iso.datetime({ offset: true });

export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;
