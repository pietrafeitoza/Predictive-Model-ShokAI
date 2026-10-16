#!/usr/bin/env node

// Seeds the model registry with the evaluated candidates documented in
// documents/documentation.md (Sections 4.4.2, 4.4.3 and 4.4.6).
//
// The values are curated reference metadata, not dataset rows, so they live in this committed
// source file. The script is idempotent: it never overwrites the rich metadata the Random Forest
// importer wrote for the selected model, it only attaches the role columns and (re)writes the
// normalized validation-fold and metric rows on which the model comparator is built.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const FEATURE_LIST = Object.freeze([
  'DEMAND_LAG_1M',
  'DEMAND_LAG_3M',
  'DEMAND_LAG_6M',
  'DEMAND_MEAN_3M',
  'DEMAND_MEAN_6M',
  'DEMAND_STD_3M',
  'PORTE_ORDINAL',
  'MONTH',
]);

const TARGET = Object.freeze({
  technical: 'volume_demanda_proxy',
  display: 'Estimated demand volume',
  unit: 'billed item quantity',
});

const CAVEATS = Object.freeze([
  'Estimated billed-item utilization demand volume; not a patient count, confirmed clinical demand, or a clinical recommendation.',
  'The opportunity tier is a provisional ranking that circulates with the documented caveats.',
]);

const GENERATED_AT = '2026-09-25T00:00:00.000Z';

const SHARED_PERIODS = Object.freeze({
  trainingPeriodStart: '2025-02-01',
  trainingPeriodEnd: '2025-09-01',
  holdoutPeriodStart: '2025-10-01',
  holdoutPeriodEnd: '2025-12-01',
});

const SHARED_FOLDS = Object.freeze([
  { origin_month: '2025-07-01', fit_start_month: '2025-02-01', fit_end_month: '2025-06-01', fit_rows: 4238, validation_rows: 1086, validation_zero_share: 0.4052, naive_validation_mae: 37.4705 },
  { origin_month: '2025-08-01', fit_start_month: '2025-02-01', fit_end_month: '2025-07-01', fit_rows: 5324, validation_rows: 1154, validation_zero_share: 0.4463, naive_validation_mae: 28.7426 },
  { origin_month: '2025-09-01', fit_start_month: '2025-02-01', fit_end_month: '2025-08-01', fit_rows: 6478, validation_rows: 1238, validation_zero_share: 0.5291, naive_validation_mae: 26.7278 },
]);

const SELECTION_CRITERION =
  'Lowest mean validation MAE across the three expanding-window folds (July, August and September 2025).';

const metric = (split, rowScope, name, value, stdDev = null) => ({
  dataset_split: split,
  row_scope: rowScope,
  metric: name,
  value,
  std_dev: stdDev,
});

const holdout = (mae, rmse, r2, skillAll, skillObserved) => [
  metric('holdout', 'all', 'mae', mae),
  metric('holdout', 'all', 'rmse', rmse),
  metric('holdout', 'all', 'r2', r2),
  metric('holdout', 'all', 'skill', skillAll),
  metric('holdout', 'observed', 'skill', skillObserved),
];

export const MODEL_CATALOG = Object.freeze([
  {
    modelKey: 'north-region-mama-demand-random-forest',
    version: 'forest-v1',
    algorithm: 'random_forest',
    status: 'selected',
    modelRole: 'provisional_challenger',
    selectionRank: 1,
    isDeployed: false,
    preserveExisting: true,
    description:
      'Shipped prediction base and strongest holdout skill; explained with SHAP. Not promoted while the holdout gate stays closed.',
    selectionCriterion: 'Lowest mean validation MAE; strongest holdout MAE and skill on both row sets.',
    hyperparameters: { n_estimators: 600, max_depth: null, min_samples_leaf: 5 },
    sourceMetadata: { notebook: '17_random_forest.ipynb', configuration: 'rf_deep_large' },
    metrics: [
      metric('validation', 'all', 'mae', 31.01, 2.43),
      ...holdout(18.141, 91.405, 0.421, 0.08, 0.211),
    ],
  },
  {
    modelKey: 'north-region-mama-demand-regularized-linear',
    version: 'v1',
    algorithm: 'elasticnet',
    status: 'candidate',
    modelRole: 'validation_leader',
    selectionRank: 2,
    isDeployed: false,
    description:
      'ElasticNet selected by the regularized-linear grid; leads validation by a small margin and has no holdout estimate yet.',
    selectionCriterion: 'Lowest mean validation MAE (24.168) with a small nested-CV optimism gap.',
    hyperparameters: { alpha: 0.01, l1_ratio: 0.5, imputer: 'mean' },
    sourceMetadata: { notebook: '18_model_comparison.ipynb', section: '5.1' },
    metrics: [metric('validation', 'all', 'mae', 24.168, 6.193)],
  },
  {
    modelKey: 'north-region-mama-demand-linear-regression',
    version: 'v2',
    algorithm: 'linear_regression',
    status: 'candidate',
    modelRole: 'linear_baseline',
    selectionRank: 3,
    isDeployed: false,
    description:
      'CV-derived linear baseline on the Medicina de Grupo population; positive aggregate skill but loses to persistence on observed rows.',
    selectionCriterion: 'Three-of-four CV rule applied from scratch on the modeling population.',
    hyperparameters: { estimator: 'OLS', imputer: 'median' },
    sourceMetadata: { notebook: '16_linear_regression.ipynb', section: '4.3.7.10' },
    metrics: [
      metric('validation', 'all', 'mae', 24.32, 6.38),
      ...holdout(19.219, 79.33, 0.564, 0.026, -0.037),
    ],
  },
  {
    modelKey: 'north-region-mama-demand-decision-tree',
    version: 'v1',
    algorithm: 'decision_tree',
    status: 'candidate',
    modelRole: 'explanatory_artifact',
    selectionRank: 4,
    isDeployed: false,
    description:
      'Readable depth-6 tree kept as the plain-language explanatory artifact for the partner.',
    selectionCriterion: 'Lowest mean validation MAE, ties broken toward the simpler tree.',
    hyperparameters: { max_depth: 6, min_samples_leaf: 20, ccp_alpha: 0.01 },
    sourceMetadata: { notebook: '15_decision_tree.ipynb', leaves: 36 },
    metrics: [
      metric('validation', 'all', 'mae', 31.333, 4.44),
      ...holdout(19.065, 89.59, 0.444, 0.033, 0.168),
    ],
  },
  {
    modelKey: 'north-region-mama-demand-linear-regression',
    version: 'v1',
    algorithm: 'linear_regression',
    status: 'archived',
    modelRole: 'legacy_baseline',
    selectionRank: null,
    isDeployed: false,
    description:
      'Legacy linear specification kept for traceability; its feature-engineering sequence was superseded by v2.',
    selectionCriterion: 'Earlier CV feature-engineering sequence, retained for comparison only.',
    hyperparameters: { estimator: 'OLS', imputer: 'median' },
    sourceMetadata: { notebook: '16_linear_regression.ipynb', section: '4.3.7.6' },
    metrics: [
      metric('validation', 'all', 'mae', 26.48),
      ...holdout(18.326, 72.298, 0.638, 0.071, 0.016),
    ],
  },
  {
    modelKey: 'baseline-seasonal-naive',
    version: 'v1',
    algorithm: 'seasonal_naive',
    status: 'candidate',
    modelRole: 'operational_default',
    selectionRank: 5,
    isDeployed: false,
    description:
      'Operational default for operator-level decisions (last month’s own value); the promotion trigger is not met yet.',
    selectionCriterion: 'Reference forecast: last observed value, zero where absent.',
    hyperparameters: {},
    sourceMetadata: { notebook: '18_model_comparison.ipynb', role: 'reference' },
    metrics: [
      metric('validation', 'all', 'mae', 30.98),
      ...holdout(19.724, 74.895, 0.611, 0, 0),
    ],
  },
  {
    modelKey: 'baseline-group-mean',
    version: 'v1',
    algorithm: 'group_mean',
    status: 'candidate',
    modelRole: 'reference',
    selectionRank: 6,
    isDeployed: false,
    description: 'Group-mean reference forecast; dominated by the seasonal-naive baseline.',
    selectionCriterion: 'Reference forecast: mean demand of the panel unit.',
    hyperparameters: {},
    sourceMetadata: { notebook: '18_model_comparison.ipynb', role: 'reference' },
    metrics: [
      metric('validation', 'all', 'mae', 32.22),
      ...holdout(31.126, 128.766, -0.149, -0.578, -0.163),
    ],
  },
]);

function fail(message, error) {
  throw new Error(error?.message ? `${message}: ${error.message}` : message);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
}

function findMetric(model, split, name) {
  return model.metrics.find((row) => row.dataset_split === split && row.metric === name);
}

function buildFullRow(model) {
  const holdoutMae = findMetric(model, 'holdout', 'mae');
  const baseMetrics = holdoutMae
    ? {
        mae: holdoutMae.value,
        rmse: findMetric(model, 'holdout', 'rmse').value,
        r2: findMetric(model, 'holdout', 'r2').value,
      }
    : {
        validationMae: findMetric(model, 'validation', 'mae').value,
        validationMaeStd: findMetric(model, 'validation', 'mae').std_dev,
      };

  return {
    model_key: model.modelKey,
    version: model.version,
    algorithm: model.algorithm,
    status: model.status,
    target_technical_name: TARGET.technical,
    target_display_name: TARGET.display,
    target_unit: TARGET.unit,
    training_period_start: SHARED_PERIODS.trainingPeriodStart,
    training_period_end: SHARED_PERIODS.trainingPeriodEnd,
    holdout_period_start: SHARED_PERIODS.holdoutPeriodStart,
    holdout_period_end: SHARED_PERIODS.holdoutPeriodEnd,
    metrics: baseMetrics,
    metric_scope: 'all_holdout_rows',
    selection_criterion: model.selectionCriterion,
    hyperparameters: model.hyperparameters,
    feature_list: [...FEATURE_LIST],
    caveats: [...CAVEATS],
    source_metadata: model.sourceMetadata,
    generated_at: GENERATED_AT,
    model_role: model.modelRole,
    selection_rank: model.selectionRank,
    is_deployed: model.isDeployed,
    description: model.description,
  };
}

export async function importModelCatalog(client) {
  const results = [];

  for (const model of MODEL_CATALOG) {
    const existing = await client
      .from('model_versions')
      .select('id,status,algorithm')
      .eq('model_key', model.modelKey)
      .eq('version', model.version)
      .maybeSingle();
    if (existing.error) throw new Error(`Could not look up ${model.modelKey} ${model.version}.`);

    let modelVersionId;
    if (existing.data) {
      modelVersionId = existing.data.id;
      const update = await client
        .from('model_versions')
        .update({
          model_role: model.modelRole,
          selection_rank: model.selectionRank,
          is_deployed: model.isDeployed,
          description: model.description,
        })
        .eq('id', modelVersionId);
      if (update.error) throw new Error(`Could not update role for ${model.modelKey}.`);
    } else {
      const inserted = await client
        .from('model_versions')
        .insert(buildFullRow(model))
        .select('id')
        .single();
      if (inserted.error || !inserted.data) {
        throw new Error(`Could not insert ${model.modelKey} ${model.version}.`);
      }
      modelVersionId = inserted.data.id;
    }

    const cleared = await client.from('model_metrics').delete().eq('model_version_id', modelVersionId);
    if (cleared.error) fail(`Could not clear metrics for ${model.modelKey}`, cleared.error);
    const metricRows = model.metrics.map((row) => ({ ...row, model_version_id: modelVersionId }));
    const insertedMetrics = await client.from('model_metrics').insert(metricRows);
    if (insertedMetrics.error) fail(`Could not insert metrics for ${model.modelKey}`, insertedMetrics.error);

    const clearedFolds = await client
      .from('model_validation_folds')
      .delete()
      .eq('model_version_id', modelVersionId);
    if (clearedFolds.error) fail(`Could not clear folds for ${model.modelKey}`, clearedFolds.error);
    if (model.algorithm !== 'seasonal_naive' && model.algorithm !== 'group_mean') {
      const foldRows = SHARED_FOLDS.map((fold) => ({ ...fold, model_version_id: modelVersionId }));
      const insertedFolds = await client.from('model_validation_folds').insert(foldRows);
      if (insertedFolds.error) fail(`Could not insert folds for ${model.modelKey}`, insertedFolds.error);
    }

    results.push({ modelKey: model.modelKey, version: model.version, modelVersionId, status: model.status });
  }

  return results;
}

async function main() {
  const supabaseUrl = requiredEnvironment('SUPABASE_URL');
  const secretKey = requiredEnvironment('SUPABASE_SECRET_KEY');
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const results = await importModelCatalog(client);
  for (const result of results) {
    console.log(`model ${result.modelKey} ${result.version} -> ${result.status} (${result.modelVersionId})`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Model catalog import failed.');
    process.exitCode = 1;
  });
}
