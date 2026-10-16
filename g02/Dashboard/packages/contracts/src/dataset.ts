import { z } from 'zod';

import { IsoTimestampSchema } from './common.js';

export const DatasetKindSchema = z.enum([
  'raw',
  'interim',
  'processed',
  'reference',
  'model_artifact',
]);

export type DatasetKind = z.infer<typeof DatasetKindSchema>;

export const DatasetSensitivitySchema = z.enum(['public', 'internal', 'partner_confidential']);

export type DatasetSensitivity = z.infer<typeof DatasetSensitivitySchema>;

export const DatasetSnapshotStatusSchema = z.enum(['available', 'pending', 'deprecated']);

export type DatasetSnapshotStatus = z.infer<typeof DatasetSnapshotStatusSchema>;

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must use the YYYY-MM-DD format.');

export const DatasetColumnSchema = z
  .object({
    name: z.string().min(1),
    dataType: z.string().min(1).nullable(),
    classification: z.string().min(1).nullable(),
    origin: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
  })
  .strict();

export type DatasetColumn = z.infer<typeof DatasetColumnSchema>;

export const DatasetSnapshotSchema = z
  .object({
    version: z.string().min(1),
    checksum: z.string().min(1).nullable(),
    storagePath: z.string().min(1).nullable(),
    rowCount: z.number().int().nonnegative().nullable(),
    columnCount: z.number().int().nonnegative().nullable(),
    periodStart: dateOnlySchema.nullable(),
    periodEnd: dateOnlySchema.nullable(),
    status: DatasetSnapshotStatusSchema,
    generatedAt: IsoTimestampSchema,
  })
  .strict();

export type DatasetSnapshot = z.infer<typeof DatasetSnapshotSchema>;

export const DatasetSourceSchema = z
  .object({
    key: z.string().min(1),
    name: z.string().min(1),
    kind: DatasetKindSchema,
    provider: z.string().min(1).nullable(),
    description: z.string().min(1).nullable(),
    sensitivity: DatasetSensitivitySchema,
    updateFrequency: z.string().min(1).nullable(),
    snapshots: z.array(DatasetSnapshotSchema),
    columns: z.array(DatasetColumnSchema),
  })
  .strict();

export type DatasetSource = z.infer<typeof DatasetSourceSchema>;

export const DatasetLineageEdgeSchema = z
  .object({
    upstreamKey: z.string().min(1),
    upstreamVersion: z.string().min(1),
    downstreamKey: z.string().min(1),
    downstreamVersion: z.string().min(1),
    relation: z.string().min(1),
    description: z.string().min(1).nullable(),
  })
  .strict();

export type DatasetLineageEdge = z.infer<typeof DatasetLineageEdgeSchema>;

export const DatasetCatalogSchema = z
  .object({
    sources: z.array(DatasetSourceSchema),
    lineage: z.array(DatasetLineageEdgeSchema),
  })
  .strict();

export type DatasetCatalog = z.infer<typeof DatasetCatalogSchema>;
