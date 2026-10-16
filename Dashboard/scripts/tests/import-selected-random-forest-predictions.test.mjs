import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  calculateChecksum,
  createOrReuseModelVersion,
  deriveReferenceMonth,
  findCompletedImport,
  importPredictions,
  mapTier,
  markCurrentBatchFailed,
  normalizeCsvRows,
  normalizeModelMetadata,
  normalizeMonth,
  validateHeaders,
} from '../import-selected-random-forest-predictions.mjs';

const headers = [
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
];

const metadata = {
  sklearn_estimator: 'RandomForestRegressor',
  target: 'volume_demanda_proxy',
  features: ['DEMAND_LAG_1M'],
  hyperparameters: { n_estimators: 600 },
  selected_on: 'mean validation MAE',
  holdout_cutoff: '2025-10-01',
  holdout_metrics_observed_only: { MAE: 10, RMSE: 20, R2: 0.5 },
  caveats: ['volume_demanda_proxy is billed item quantity, not a patient count'],
};

function csvRow(overrides = {}) {
  const values = {
    ID_PLANO: '000123',
    treatment_line_primary: 'advanced',
    UF_PRESTADOR: 'AM',
    MES: '2025-10-01',
    volume_previsto: '12.5',
    volume_observado: '10',
    target_measured: 'True',
    is_structural_zero: 'False',
    has_recent_history: 'True',
    tier: 'alto',
    ...overrides,
  };
  return `${headers.join(',')}\n${headers.map((header) => values[header]).join(',')}\n`;
}

test('validates required CSV columns', () => {
  assert.throws(() => validateHeaders(headers.slice(1)), /ID_PLANO/);
  assert.doesNotThrow(() => validateHeaders(headers));
});

test('normalizes supported MES forms and derives the previous calendar month', () => {
  assert.equal(normalizeMonth('2025-10'), '2025-10');
  assert.equal(normalizeMonth('2025-10-31'), '2025-10');
  assert.equal(deriveReferenceMonth('2025-01'), '2024-12');
});

test('maps the source tiers exactly', () => {
  assert.deepEqual(['baixo', 'medio', 'alto'].map(mapTier), ['low', 'medium', 'high']);
  assert.throws(() => mapTier('critical'), /Unsupported tier/);
});

test('rejects invalid states and negative predicted demand volume', () => {
  assert.throws(() => normalizeCsvRows(csvRow({ UF_PRESTADOR: 'SP' })), /provider state/);
  assert.throws(() => normalizeCsvRows(csvRow({ volume_previsto: '-1' })), /non-negative/);
});

test('normalizes a valid row without calculating a tier threshold', () => {
  const [row] = normalizeCsvRows(csvRow());
  assert.deepEqual(row, {
    operator_id: '000123',
    operator_name: null,
    treatment_line: 'advanced',
    provider_state: 'AM',
    reference_month: '2025-09-01',
    forecast_month: '2025-10-01',
    predicted_demand_volume: '12.5',
    observed_demand_volume: '10',
    opportunity_tier: 'high',
    target_measured: true,
    is_structural_zero: false,
    has_recent_history: true,
  });
});

test('calculates a deterministic SHA-256 checksum', () => {
  assert.equal(calculateChecksum('same input'), calculateChecksum(Buffer.from('same input')));
  assert.notEqual(calculateChecksum('same input'), calculateChecksum('different input'));
});

test('prefers observed-only metrics and rejects malformed metadata', () => {
  const normalized = normalizeModelMetadata(
    metadata,
    ['2025-10', '2025-12'],
    '2026-09-10T12:00:00.000Z',
  );
  assert.equal(normalized.metric_scope, 'observed_only_holdout');
  assert.equal(normalized.training_period_start, null);
  assert.equal(normalized.training_period_end, '2025-09-01');
  assert.equal(normalized.holdout_period_end, '2025-12-01');
  assert.throws(
    () => normalizeModelMetadata({}, ['2025-10'], '2026-09-10T12:00:00.000Z'),
    /RandomForestRegressor/,
  );
});

function chain(result) {
  const calls = [];
  const target = {
    select(...args) { calls.push(['select', ...args]); return target; },
    eq(...args) { calls.push(['eq', ...args]); return target; },
    delete(...args) { calls.push(['delete', ...args]); return target; },
    insert(...args) { calls.push(['insert', ...args]); return target; },
    single() { calls.push(['single']); return Promise.resolve(result); },
    update(...args) { calls.push(['update', ...args]); return target; },
    maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); },
    then(resolve) { return Promise.resolve(result).then(resolve); },
  };
  return { calls, target };
}

test('restores a compatible archived model version to selected status before reuse', async () => {
  const modelVersion = normalizeModelMetadata(
    metadata,
    ['2025-10'],
    '2026-09-10T12:00:00.000Z',
  );
  const existing = chain({
    data: {
      id: 'model-1',
      model_key: modelVersion.model_key,
      version: modelVersion.version,
      algorithm: modelVersion.algorithm,
      status: 'archived',
      target_technical_name: modelVersion.target_technical_name,
      source_metadata: modelVersion.source_metadata,
    },
    error: null,
  });
  const selected = chain({ data: { id: 'model-1' }, error: null });
  let queryCount = 0;
  const client = {
    from() {
      queryCount += 1;
      return queryCount === 1 ? existing.target : selected.target;
    },
  };

  await assert.doesNotReject(() => createOrReuseModelVersion(client, modelVersion));
  assert.ok(
    selected.calls.some(
      (call) => call[0] === 'update' && call[1].status === 'selected',
    ),
  );
  assert.ok(
    selected.calls.some((call) => call[0] === 'eq' && call[1] === 'id' && call[2] === 'model-1'),
  );
});

test('rejects duplicate completed imports by finding the same checksum and model version', async () => {
  const query = chain({ data: { id: 'completed-1', row_count: 4 }, error: null });
  const client = { from: () => query.target };
  const result = await findCompletedImport(client, 'model-1', 'a'.repeat(64));
  assert.equal(result.id, 'completed-1');
  assert.ok(query.calls.some((call) => call[0] === 'eq' && call[1] === 'status' && call[2] === 'completed'));
});

test('partial-failure cleanup targets only the current import batch', async () => {
  const deletion = chain({ error: null });
  const update = chain({ error: null });
  const client = {
    from(table) { return table === 'predictions' ? deletion.target : update.target; },
  };
  await markCurrentBatchFailed(
    client,
    'current-import-only',
    'Import failed during prediction insertion.',
    '2026-09-10T12:00:00.000Z',
  );
  assert.ok(deletion.calls.some((call) => call[0] === 'eq' && call[1] === 'import_batch_id' && call[2] === 'current-import-only'));
  assert.ok(update.calls.some((call) => call[0] === 'eq' && call[1] === 'id' && call[2] === 'current-import-only'));
  assert.ok(!JSON.stringify([...deletion.calls, ...update.calls]).includes('SUPABASE_SECRET_KEY'));
});

test('does not delete verified predictions when the final completion update fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dashboard-import-test-'));
  const csvPath = join(directory, 'predictions.csv');
  const bundlePath = join(directory, 'model.joblib');
  await Promise.all([writeFile(csvPath, csvRow()), writeFile(bundlePath, 'trusted-test-bundle')]);

  const modelVersion = normalizeModelMetadata(
    metadata,
    ['2025-10'],
    '2026-09-10T12:00:00.000Z',
  );
  const modelQuery = chain({
    data: {
      id: 'model-1',
      model_key: modelVersion.model_key,
      version: modelVersion.version,
      algorithm: modelVersion.algorithm,
      status: 'selected',
      target_technical_name: modelVersion.target_technical_name,
      source_metadata: modelVersion.source_metadata,
    },
    error: null,
  });
  const importQueries = [
    chain({ data: null, error: null }),
    chain({ data: { id: 'import-1' }, error: null }),
    chain({ data: null, error: new Error('Temporary network failure') }),
  ];
  const predictionQueries = [
    chain({ error: null }),
    chain({ data: null, error: null, count: 1 }),
  ];
  let importQueryIndex = 0;
  let predictionQueryIndex = 0;
  const client = {
    from(table) {
      if (table === 'model_versions') return modelQuery.target;
      if (table === 'prediction_imports') return importQueries[importQueryIndex++].target;
      if (table === 'predictions') return predictionQueries[predictionQueryIndex++].target;
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  try {
    await assert.rejects(
      () => importPredictions({
        client,
        csvPath,
        bundlePath,
        pythonBin: 'python3',
        helperPath: 'unused.py',
        metadataExtractor: async () => metadata,
      }),
      /Import failed during import completion/,
    );
    assert.equal(predictionQueryIndex, 2);
    assert.ok(
      predictionQueries.every(({ calls }) => calls.every((call) => call[0] !== 'delete')),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
