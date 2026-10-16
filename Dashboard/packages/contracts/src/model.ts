import { z } from 'zod';

import {
  IsoTimestampSchema,
  ModelAlgorithmSchema,
  ModelStatusSchema,
  YearMonthSchema,
} from './common.js';

const finiteMetricSchema = z.number().finite();
const nonNegativeMetricSchema = finiteMetricSchema.nonnegative();
const nonEmptyIdentifierSchema = z.string().min(1);

export const ModelMetricsSchema = z
  .object({
    mae: nonNegativeMetricSchema.nullable(),
    rmse: nonNegativeMetricSchema.nullable(),
    r2: finiteMetricSchema.nullable(),
    maeLog1p: nonNegativeMetricSchema.nullable().optional(),
    skillVsNaive: finiteMetricSchema.nullable().optional(),
    testRowCount: z.number().int().positive().optional(),
  })
  .strict();

export type ModelMetrics = z.infer<typeof ModelMetricsSchema>;

export const ModelGranularitySchema = z.tuple([
  z.literal('operator'),
  z.literal('treatment_line'),
  z.literal('provider_state'),
  z.literal('month'),
]);

export type ModelGranularity = z.infer<typeof ModelGranularitySchema>;

export const ModelMetricScopeSchema = z.enum([
  'observed_only_holdout',
  'all_holdout_rows',
]);

export type ModelMetricScope = z.infer<typeof ModelMetricScopeSchema>;

export const ModelSummarySchema = z
  .object({
    modelId: nonEmptyIdentifierSchema,
    modelVersion: nonEmptyIdentifierSchema,
    algorithm: ModelAlgorithmSchema,
    status: ModelStatusSchema,
    targetTechnicalName: z.literal('volume_demanda_proxy'),
    targetDisplayName: z.literal('Estimated demand volume'),
    targetUnit: z.literal('billed item quantity'),
    granularity: ModelGranularitySchema,
    trainingPeriodStart: YearMonthSchema.nullable(),
    trainingPeriodEnd: YearMonthSchema,
    holdoutPeriodStart: YearMonthSchema,
    holdoutPeriodEnd: YearMonthSchema,
    metrics: ModelMetricsSchema,
    metricScope: ModelMetricScopeSchema,
    caveat: z.string().min(1),
    generatedAt: IsoTimestampSchema,
  })
  .strict();

export type ModelSummary = z.infer<typeof ModelSummarySchema>;

export const SelectedModelSummarySchema = ModelSummarySchema.extend({
  status: z.literal('selected'),
});

export type SelectedModelSummary = z.infer<typeof SelectedModelSummarySchema>;

export const ModelComparisonRecordSchema = z
  .object({
    modelId: nonEmptyIdentifierSchema,
    algorithm: ModelAlgorithmSchema,
    metrics: ModelMetricsSchema,
    selected: z.boolean(),
  })
  .strict();

export type ModelComparisonRecord = z.infer<typeof ModelComparisonRecordSchema>;

export const ModelMetricNameSchema = z.enum(['mae', 'rmse', 'r2', 'skill', 'mae_log1p']);

export type ModelMetricName = z.infer<typeof ModelMetricNameSchema>;

export const ModelMetricRecordSchema = z
  .object({
    split: z.enum(['validation', 'holdout']),
    rowScope: z.enum(['all', 'observed', 'none']),
    metric: ModelMetricNameSchema,
    value: z.number().finite(),
    stdDev: z.number().finite().nonnegative().nullable(),
  })
  .strict();

export type ModelMetricRecord = z.infer<typeof ModelMetricRecordSchema>;

export const ModelValidationFoldSchema = z
  .object({
    originMonth: YearMonthSchema,
    fitStartMonth: YearMonthSchema.nullable(),
    fitEndMonth: YearMonthSchema.nullable(),
    fitRows: z.number().int().nonnegative().nullable(),
    validationRows: z.number().int().nonnegative().nullable(),
    validationZeroShare: z.number().min(0).max(1).nullable(),
    naiveValidationMae: z.number().finite().nonnegative().nullable(),
  })
  .strict();

export type ModelValidationFold = z.infer<typeof ModelValidationFoldSchema>;

export const ModelRegistryEntrySchema = z
  .object({
    modelId: nonEmptyIdentifierSchema,
    modelVersion: nonEmptyIdentifierSchema,
    algorithm: ModelAlgorithmSchema,
    status: ModelStatusSchema,
    role: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
    selected: z.boolean(),
    deployed: z.boolean(),
    hasPredictionImport: z.boolean(),
    selectionRank: z.number().int().positive().nullable(),
    targetTechnicalName: z.literal('volume_demanda_proxy'),
    targetDisplayName: z.literal('Estimated demand volume'),
    targetUnit: z.literal('billed item quantity'),
    trainingPeriodStart: YearMonthSchema.nullable(),
    trainingPeriodEnd: YearMonthSchema,
    holdoutPeriodStart: YearMonthSchema,
    holdoutPeriodEnd: YearMonthSchema,
    metricScope: ModelMetricScopeSchema,
    selectionCriterion: z.string().min(1),
    hyperparameters: z.record(z.string(), z.unknown()),
    featureList: z.array(z.string().min(1)),
    caveats: z.array(z.string().min(1)),
    generatedAt: IsoTimestampSchema,
    metrics: z.array(ModelMetricRecordSchema),
    validationFolds: z.array(ModelValidationFoldSchema),
  })
  .strict();

export type ModelRegistryEntry = z.infer<typeof ModelRegistryEntrySchema>;
