import { z } from 'zod';

const figureSchema = z.object({
  title: z.string().min(1),
  imagePath: z.string().startsWith('/assets/model-explainability/'),
  alt: z.string().min(1),
  caption: z.string().min(1),
}).strict();

const globalFigureSchema = z.discriminatedUnion('kind', [
  figureSchema.extend({ kind: z.literal('bar') }),
  figureSchema.extend({ kind: z.literal('beeswarm') }),
  figureSchema.extend({
    kind: z.literal('dependence'),
    panelAspectRatio: z.number().positive().finite(),
    panels: z.array(z.object({ label: z.string().min(1) }).strict()).min(1),
  }),
]);

export const ModelExplainabilitySchema = z.object({
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
  method: z.literal('SHAP TreeExplainer'),
  targetUnit: z.literal('billed items per month'),
  sampleSize: z.number().int().positive(),
  holdoutSize: z.number().int().positive(),
  expectedValue: z.number().finite(),
  globalFigures: z.array(globalFigureSchema).min(1),
  features: z.array(z.object({
    name: z.string().min(1),
    meanAbsoluteShap: z.number().nonnegative(),
    sharePercent: z.number().min(0).max(100),
  }).strict()).min(1),
  localExamples: z.array(figureSchema.extend({
    context: z.string().min(1),
    observed: z.number().nonnegative(),
    predicted: z.number().nonnegative(),
  })).min(1),
  limitations: z.array(z.string().min(1)).min(1),
}).strict();

export type ModelExplainability = z.infer<typeof ModelExplainabilitySchema>;
