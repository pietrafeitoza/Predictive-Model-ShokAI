import { z } from 'zod';

import { IsoTimestampSchema } from './common.js';
import {
  DashboardBacktestSchema,
  DashboardDistributionItemSchema,
  DashboardFilterOptionsSchema,
  DashboardSummarySchema,
} from './dashboard.js';
import {
  ModelComparisonRecordSchema,
  ModelRegistryEntrySchema,
  SelectedModelSummarySchema,
} from './model.js';
import { DatasetCatalogSchema } from './dataset.js';
import { ModelExplainabilitySchema } from './explainability.js';
import { PredictionRecordSchema } from './prediction.js';

const responseMetadataBase = z.object({
  generatedAt: IsoTimestampSchema,
});

const supabaseResponseMetadataSchema = responseMetadataBase
  .extend({
    source: z.literal('supabase'),
    modelId: z.string().min(1).nullable(),
    modelVersion: z.string().min(1).nullable(),
  })
  .strict()
  .refine((metadata) => (metadata.modelId === null) === (metadata.modelVersion === null), {
    message: 'Supabase model identifiers must both be present or both be null.',
  });

export const ResponseMetadataSchema = z.discriminatedUnion('source', [
  responseMetadataBase.extend({
    source: z.literal('mock'),
    modelId: z.null(),
    modelVersion: z.null(),
  }).strict(),
  supabaseResponseMetadataSchema,
]);

export type ResponseMetadata = z.infer<typeof ResponseMetadataSchema>;

export const PredictionListResponseSchema = z
  .object({
    data: z.array(PredictionRecordSchema),
    meta: ResponseMetadataSchema,
  })
  .strict();

export type PredictionListResponse = z.infer<typeof PredictionListResponseSchema>;

export const DashboardSummaryResponseSchema = z
  .object({
    data: DashboardSummarySchema,
    meta: ResponseMetadataSchema,
  })
  .strict();

export type DashboardSummaryResponse = z.infer<typeof DashboardSummaryResponseSchema>;

export const DashboardBacktestResponseSchema = z
  .object({
    data: DashboardBacktestSchema,
    meta: ResponseMetadataSchema,
  })
  .strict();

export type DashboardBacktestResponse = z.infer<typeof DashboardBacktestResponseSchema>;

export const DashboardDistributionResponseSchema = z
  .object({
    data: z.array(DashboardDistributionItemSchema),
    meta: ResponseMetadataSchema,
  })
  .strict();

export type DashboardDistributionResponse = z.infer<
  typeof DashboardDistributionResponseSchema
>;

export const DashboardFilterOptionsResponseSchema = z
  .object({
    data: DashboardFilterOptionsSchema,
    meta: ResponseMetadataSchema,
  })
  .strict();

export type DashboardFilterOptionsResponse = z.infer<
  typeof DashboardFilterOptionsResponseSchema
>;

export const SelectedModelResponseSchema = z
  .object({
    data: SelectedModelSummarySchema.nullable(),
    meta: ResponseMetadataSchema,
  })
  .strict()
  .superRefine((response, context) => {
    if (response.meta.source === 'mock' && response.data !== null) {
      context.addIssue({ code: 'custom', message: 'Mock responses cannot invent model data.' });
    }

    if (
      response.meta.source === 'supabase' &&
      response.data !== null &&
      (response.meta.modelId !== response.data.modelId ||
        response.meta.modelVersion !== response.data.modelVersion)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Supabase model response metadata must identify the returned model.',
      });
    }
  });

export type SelectedModelResponse = z.infer<typeof SelectedModelResponseSchema>;

export const ModelExplainabilityResponseSchema = z.object({
  data: ModelExplainabilitySchema.nullable(),
  meta: ResponseMetadataSchema,
}).strict().superRefine((response, context) => {
  if (response.meta.source === 'supabase' && response.data &&
    (response.meta.modelId !== response.data.modelId ||
      response.meta.modelVersion !== response.data.modelVersion)) {
    context.addIssue({
      code: 'custom',
      message: 'Explainability must match the selected model version.',
    });
  }
});

export type ModelExplainabilityResponse = z.infer<typeof ModelExplainabilityResponseSchema>;

export const ModelComparisonResponseSchema = z
  .object({
    data: z.array(ModelComparisonRecordSchema),
    meta: ResponseMetadataSchema,
  })
  .strict();

export type ModelComparisonResponse = z.infer<typeof ModelComparisonResponseSchema>;

export const ModelRegistryResponseSchema = z
  .object({
    data: z.array(ModelRegistryEntrySchema),
    meta: ResponseMetadataSchema,
  })
  .strict();

export type ModelRegistryResponse = z.infer<typeof ModelRegistryResponseSchema>;

export const DatasetCatalogResponseSchema = z
  .object({
    data: DatasetCatalogSchema,
    meta: ResponseMetadataSchema,
  })
  .strict();

export type DatasetCatalogResponse = z.infer<typeof DatasetCatalogResponseSchema>;
