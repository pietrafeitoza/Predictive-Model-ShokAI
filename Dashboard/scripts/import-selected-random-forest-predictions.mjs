#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'csv-parse/sync';

export const MODEL_KEY = 'north-region-mama-demand-random-forest';
export const MODEL_VERSION = 'forest-v1';

export const REQUIRED_CSV_HEADERS = Object.freeze([
  'ID_PLANO',
  'treatment_line_primary',
  'UF_PRESTADOR',
  'MES',
  'volume_previsto',
  'volume_observado',
  'target_measured',
  'is_structural_zero',
  'has_recent_history',
  'tier',
]);

const supportedTreatmentLines = new Set([
  'staging',
  'neoadjuvant',
  'adjuvant',
  'advanced',
  'unknown',
]);
const supportedStates = new Set(['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO']);
const tierMap = new Map([
  ['baixo', 'low'],
  ['medio', 'medium'],
  ['alto', 'high'],
]);

function fail(message) {
  throw new Error(message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function calculateChecksum(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

export function normalizeMonth(rawValue) {
  const value = String(rawValue ?? '').trim();
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) fail(`Invalid MES value: ${value || '<empty>'}.`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] === undefined ? 1 : Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 || month > 12 || day < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    fail(`Invalid MES value: ${value}.`);
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function deriveReferenceMonth(forecastMonth) {
  const normalized = normalizeMonth(forecastMonth);
  const [year, month] = normalized.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function mapTier(rawTier) {
  const normalized = tierMap.get(String(rawTier ?? '').trim());
  if (!normalized) fail(`Unsupported tier value: ${String(rawTier ?? '') || '<empty>'}.`);
  return normalized;
}

function parseBoolean(rawValue, fieldName, rowNumber) {
  const value = String(rawValue ?? '').trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  fail(`Row ${rowNumber}: ${fieldName} must be true or false.`);
}

function parseVolume(rawValue, fieldName, rowNumber, nullable = false) {
  const value = String(rawValue ?? '').trim();
  if (nullable && value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(`Row ${rowNumber}: ${fieldName} must be a non-negative number.`);
  }
  // Pass the validated source text to PostgreSQL NUMERIC so storage does not round through a
  // JavaScript floating-point representation.
  return value;
}

export function validateHeaders(headers) {
  const missing = REQUIRED_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) fail(`CSV is missing required columns: ${missing.join(', ')}.`);
}

export function normalizeCsvRows(csvContents) {
  let headers = [];
  const rawRows = parse(csvContents, {
    bom: true,
    columns: (foundHeaders) => {
      headers = foundHeaders;
      validateHeaders(foundHeaders);
      return foundHeaders;
    },
    skip_empty_lines: true,
    trim: true,
  });

  if (headers.length === 0) fail('CSV does not contain a header row.');

  const seenGrains = new Set();
  return rawRows.map((row, index) => {
    const rowNumber = index + 2;
    const operatorId = String(row.ID_PLANO ?? '').trim();
    const treatmentLine = String(row.treatment_line_primary ?? '').trim();
    const providerState = String(row.UF_PRESTADOR ?? '').trim();
    const forecastMonth = normalizeMonth(row.MES);

    if (!operatorId) fail(`Row ${rowNumber}: ID_PLANO is required.`);
    if (!supportedTreatmentLines.has(treatmentLine)) {
      fail(`Row ${rowNumber}: unsupported treatment line ${treatmentLine || '<empty>'}.`);
    }
    if (!supportedStates.has(providerState)) {
      fail(`Row ${rowNumber}: unsupported provider state ${providerState || '<empty>'}.`);
    }

    const grain = [operatorId, treatmentLine, providerState, forecastMonth].join('\u001f');
    if (seenGrains.has(grain)) fail(`Row ${rowNumber}: duplicate prediction grain in CSV.`);
    seenGrains.add(grain);

    return {
      operator_id: operatorId,
      operator_name: null,
      treatment_line: treatmentLine,
      provider_state: providerState,
      reference_month: `${deriveReferenceMonth(forecastMonth)}-01`,
      forecast_month: `${forecastMonth}-01`,
      predicted_demand_volume: parseVolume(
        row.volume_previsto,
        'volume_previsto',
        rowNumber,
      ),
      observed_demand_volume: parseVolume(
        row.volume_observado,
        'volume_observado',
        rowNumber,
        true,
      ),
      opportunity_tier: mapTier(row.tier),
      target_measured: parseBoolean(row.target_measured, 'target_measured', rowNumber),
      is_structural_zero: parseBoolean(
        row.is_structural_zero,
        'is_structural_zero',
        rowNumber,
      ),
      has_recent_history: parseBoolean(
        row.has_recent_history,
        'has_recent_history',
        rowNumber,
      ),
    };
  });
}

function requiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`Model metadata field ${fieldName} must be a non-empty string.`);
  }
  return value;
}

function requiredFiniteMetric(metrics, sourceKey) {
  const value = metrics?.[sourceKey];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`Model metadata metric ${sourceKey} must be finite.`);
  }
  if (sourceKey !== 'R2' && sourceKey !== 'skill' && value < 0) {
    fail(`Model metadata metric ${sourceKey} cannot be negative.`);
  }
  return value;
}

export function normalizeModelMetadata(metadata, forecastMonths, generatedAt) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    fail('Model metadata must be a JSON object.');
  }
  if (metadata.sklearn_estimator !== 'RandomForestRegressor') {
    fail('Model metadata does not identify RandomForestRegressor.');
  }
  if (metadata.target !== 'volume_demanda_proxy') {
    fail('Model metadata has an unsupported target.');
  }
  if (!Array.isArray(metadata.features) || metadata.features.some((value) => typeof value !== 'string')) {
    fail('Model metadata features must be an array of strings.');
  }
  if (!metadata.hyperparameters || typeof metadata.hyperparameters !== 'object' || Array.isArray(metadata.hyperparameters)) {
    fail('Model metadata hyperparameters must be an object.');
  }
  if (!Array.isArray(metadata.caveats) || metadata.caveats.some((value) => typeof value !== 'string')) {
    fail('Model metadata caveats must be an array of strings.');
  }

  const uniqueForecastMonths = [...new Set(forecastMonths.map(normalizeMonth))].sort();
  if (uniqueForecastMonths.length === 0) fail('The predictions CSV does not contain any rows.');

  const holdoutStart = normalizeMonth(requiredString(metadata.holdout_cutoff, 'holdout_cutoff'));
  if (uniqueForecastMonths[0] < holdoutStart) {
    fail('Predictions contain a month before the metadata holdout cutoff.');
  }

  const observedMetrics = metadata.holdout_metrics_observed_only;
  const allRowMetrics = metadata.holdout_metrics_all_rows;
  const useObservedMetrics = observedMetrics && typeof observedMetrics === 'object';
  const sourceMetrics = useObservedMetrics ? observedMetrics : allRowMetrics;
  if (!sourceMetrics || typeof sourceMetrics !== 'object') {
    fail('Model metadata does not contain supported holdout metrics.');
  }

  const metrics = {
    mae: requiredFiniteMetric(sourceMetrics, 'MAE'),
    rmse: requiredFiniteMetric(sourceMetrics, 'RMSE'),
    r2: requiredFiniteMetric(sourceMetrics, 'R2'),
  };
  if (sourceMetrics.MAE_log1p !== undefined) {
    metrics.maeLog1p = requiredFiniteMetric(sourceMetrics, 'MAE_log1p');
  }
  if (sourceMetrics.skill !== undefined) {
    metrics.skillVsNaive = requiredFiniteMetric(sourceMetrics, 'skill');
  }

  return {
    model_key: MODEL_KEY,
    version: MODEL_VERSION,
    algorithm: 'random_forest',
    status: 'selected',
    target_technical_name: 'volume_demanda_proxy',
    target_display_name: 'Estimated demand volume',
    target_unit: 'billed item quantity',
    training_period_start: null,
    training_period_end: `${deriveReferenceMonth(holdoutStart)}-01`,
    holdout_period_start: `${holdoutStart}-01`,
    holdout_period_end: `${uniqueForecastMonths.at(-1)}-01`,
    metrics,
    metric_scope: useObservedMetrics ? 'observed_only_holdout' : 'all_holdout_rows',
    selection_criterion: requiredString(metadata.selected_on, 'selected_on'),
    hyperparameters: metadata.hyperparameters,
    feature_list: metadata.features,
    caveats: metadata.caveats,
    source_metadata: metadata,
    generated_at: generatedAt,
  };
}

export function extractMetadataWithPython(pythonBin, helperPath, bundlePath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(pythonBin, [helperPath, bundlePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', () => rejectPromise(new Error('Could not start the configured Python executable.')));
    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || 'Metadata extraction failed.'));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch {
        rejectPromise(new Error('Metadata helper did not emit valid JSON.'));
      }
    });
  });
}

export async function createOrReuseModelVersion(client, modelVersion) {
  const existingQuery = await client
    .from('model_versions')
    .select('id,model_key,version,algorithm,status,target_technical_name,source_metadata')
    .eq('model_key', modelVersion.model_key)
    .eq('version', modelVersion.version)
    .maybeSingle();
  if (existingQuery.error) fail('Could not check the selected model version.');
  if (existingQuery.data) {
    if (
      existingQuery.data.algorithm !== modelVersion.algorithm ||
      existingQuery.data.target_technical_name !== modelVersion.target_technical_name ||
      stableJson(existingQuery.data.source_metadata) !== stableJson(modelVersion.source_metadata)
    ) {
      fail('Existing model version conflicts with the selected model metadata.');
    }

    if (existingQuery.data.status !== 'selected') {
      const selected = await client
        .from('model_versions')
        .update({ status: 'selected' })
        .eq('id', existingQuery.data.id)
        .select('id')
        .single();
      if (selected.error || !selected.data) {
        fail('Could not restore the existing model version to selected status.');
      }
    }

    return existingQuery.data.id;
  }

  const inserted = await client.from('model_versions').insert(modelVersion).select('id').single();
  if (inserted.error || !inserted.data) fail('Could not create the selected model version.');
  return inserted.data.id;
}

export async function findCompletedImport(client, modelVersionId, checksum) {
  const result = await client
    .from('prediction_imports')
    .select('id,row_count')
    .eq('model_version_id', modelVersionId)
    .eq('source_checksum', checksum)
    .eq('status', 'completed')
    .maybeSingle();
  if (result.error) fail('Could not check prior completed imports.');
  return result.data;
}

export async function markCurrentBatchFailed(client, importBatchId, safeReason, now) {
  if (!importBatchId) return;
  const cleanup = await client.from('predictions').delete().eq('import_batch_id', importBatchId);
  const update = await client
    .from('prediction_imports')
    .update({ status: 'failed', failed_at: now, safe_failure_reason: safeReason })
    .eq('id', importBatchId)
    .eq('status', 'importing');
  if (cleanup.error || update.error) {
    throw new Error('Import failed and its current batch could not be finalized safely.');
  }
}

export async function importPredictions({
  client,
  csvPath,
  bundlePath,
  pythonBin,
  helperPath,
  batchSize = 500,
  clock = () => new Date(),
  metadataExtractor = extractMetadataWithPython,
}) {
  let importBatchId = null;
  let predictionsVerified = false;
  let phase = 'input validation';

  try {
    const [csvContents, bundleStats] = await Promise.all([readFile(csvPath), stat(bundlePath)]);
    const checksum = calculateChecksum(csvContents);
    const predictions = normalizeCsvRows(csvContents);

    phase = 'metadata extraction';
    const sourceMetadata = await metadataExtractor(pythonBin, helperPath, bundlePath);
    const modelVersion = normalizeModelMetadata(
      sourceMetadata,
      predictions.map(({ forecast_month }) => forecast_month),
      bundleStats.mtime.toISOString(),
    );

    phase = 'model version setup';
    const modelVersionId = await createOrReuseModelVersion(client, modelVersion);
    const completedImport = await findCompletedImport(client, modelVersionId, checksum);
    if (completedImport) {
      return {
        status: 'skipped',
        importBatchId: completedImport.id,
        modelKey: MODEL_KEY,
        modelVersion: MODEL_VERSION,
        checksum,
        rowCount: completedImport.row_count,
      };
    }

    phase = 'import batch creation';
    const startedAt = clock().toISOString();
    const createdImport = await client
      .from('prediction_imports')
      .insert({
        model_version_id: modelVersionId,
        source_filename: basename(csvPath),
        source_checksum: checksum,
        row_count: predictions.length,
        status: 'importing',
        started_at: startedAt,
      })
      .select('id')
      .single();
    if (createdImport.error || !createdImport.data) fail('Could not create the import batch.');
    importBatchId = createdImport.data.id;

    phase = 'prediction insertion';
    for (let offset = 0; offset < predictions.length; offset += batchSize) {
      const batch = predictions.slice(offset, offset + batchSize).map((prediction) => ({
        ...prediction,
        import_batch_id: importBatchId,
      }));
      const inserted = await client.from('predictions').insert(batch);
      if (inserted.error) fail('Could not insert a prediction batch.');
    }

    phase = 'inserted row verification';
    const counted = await client
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('import_batch_id', importBatchId);
    if (counted.error || counted.count !== predictions.length) {
      fail('Inserted prediction count does not match the validated CSV row count.');
    }
    predictionsVerified = true;

    phase = 'import completion';
    const completedAt = clock().toISOString();
    const completed = await client
      .from('prediction_imports')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', importBatchId)
      .eq('status', 'importing')
      .select('id')
      .single();
    if (completed.error || !completed.data) fail('Could not complete the import batch.');

    return {
      status: 'completed',
      importBatchId,
      modelKey: MODEL_KEY,
      modelVersion: MODEL_VERSION,
      checksum,
      rowCount: predictions.length,
    };
  } catch (error) {
    const safeReason = `Import failed during ${phase}.`;
    if (importBatchId && !predictionsVerified) {
      await markCurrentBatchFailed(client, importBatchId, safeReason, clock().toISOString());
    }
    throw new Error(safeReason, { cause: error });
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Missing required environment variable: ${name}.`);
  return value;
}

async function assertFile(path, label) {
  try {
    const details = await stat(path);
    if (!details.isFile()) fail(`${label} is not a file: ${path}`);
  } catch {
    fail(`${label} does not exist: ${path}`);
  }
}

async function main() {
  const csvPath = resolve(requiredEnvironment('RANDOM_FOREST_PREDICTIONS_PATH'));
  const bundlePath = resolve(requiredEnvironment('RANDOM_FOREST_MODEL_BUNDLE_PATH'));
  const pythonBin = process.env.PYTHON_BIN?.trim() || 'python3';
  const supabaseUrl = requiredEnvironment('SUPABASE_URL');
  const secretKey = requiredEnvironment('SUPABASE_SECRET_KEY');
  const helperPath = resolve(dirname(fileURLToPath(import.meta.url)), 'extract-random-forest-metadata.py');

  await assertFile(csvPath, 'Predictions CSV');
  await assertFile(bundlePath, 'Model bundle');
  await assertFile(helperPath, 'Metadata helper');

  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const result = await importPredictions({
    client,
    csvPath,
    bundlePath,
    pythonBin,
    helperPath,
  });
  const action = result.status === 'skipped' ? 'already completed; skipped' : 'completed';
  console.log(
    `Random Forest import ${action}: ${result.rowCount} rows, model ${result.modelVersion}, checksum ${result.checksum}.`,
  );
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Import failed.');
    process.exitCode = 1;
  });
}
