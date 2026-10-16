import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  PREDICTION_PAGE_SIZE,
  SupabaseDashboardRepository,
} from '../src/repositories/supabase-dashboard.repository.js';

function builder(result: unknown) {
  const value: Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: vi.fn((resolve) => Promise.resolve(result).then(resolve)),
  };
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'range']) {
    value[method].mockReturnValue(value);
  }
  return value;
}

const modelRow = {
  id: 'model-row-1',
  model_key: 'north-region-mama-demand-random-forest',
  version: 'forest-v1',
  algorithm: 'random_forest',
  status: 'selected',
  target_technical_name: 'volume_demanda_proxy',
  target_display_name: 'Estimated demand volume',
  target_unit: 'billed item quantity',
  training_period_start: null,
  training_period_end: '2025-09-01',
  holdout_period_start: '2025-10-01',
  holdout_period_end: '2025-12-01',
  metrics: { mae: 57.471, rmse: 362.961, r2: 0.802 },
  metric_scope: 'observed_only_holdout',
  caveats: ['volume_demanda_proxy is billed item quantity, not a patient count'],
  generated_at: '2026-09-10T12:00:00.000Z',
};

function createClient(predictionResult: unknown = { data: [], error: null }) {
  const modelBuilder = builder({ data: modelRow, error: null });
  const importBuilder = builder({
    data: { id: 'import-1', started_at: '2026-09-10T13:00:00.000Z' },
    error: null,
  });
  const predictionBuilder = builder(predictionResult);
  const from = vi.fn((table: string) => ({
    model_versions: modelBuilder,
    prediction_imports: importBuilder,
    predictions: predictionBuilder,
  })[table]);
  return {
    client: { from } as unknown as SupabaseClient,
    importBuilder,
    modelBuilder,
    predictionBuilder,
  };
}

describe('SupabaseDashboardRepository', () => {
  it('queries the selected model and latest completed import, maps rows, and applies filters', async () => {
    const setup = createClient({
      data: [
        {
          id: 91,
          operator_id: '000123',
          operator_name: null,
          treatment_line: 'advanced',
          provider_state: 'AM',
          reference_month: '2025-09-01',
          forecast_month: '2025-10-01',
          predicted_demand_volume: '123.4500',
          observed_demand_volume: '118',
          opportunity_tier: 'high',
        },
        {
          id: 92,
          operator_id: '000999',
          operator_name: null,
          treatment_line: 'advanced',
          provider_state: 'PA',
          reference_month: '2025-10-01',
          forecast_month: '2025-11-01',
          predicted_demand_volume: '9',
          observed_demand_volume: null,
          opportunity_tier: 'low',
        },
      ],
      error: null,
    });
    const repository = new SupabaseDashboardRepository(setup.client);

    await expect(
      repository.findPredictions({ providerStates: ['AM'], forecastMonths: ['2025-10'] }),
    ).resolves.toEqual([
      {
        predictionId: '91',
        operatorId: '000123',
        operatorName: null,
        treatmentLine: 'advanced',
        providerState: 'AM',
        referenceMonth: '2025-09',
        forecastMonth: '2025-10',
        predictedDemandVolume: 123.45,
        observedDemandVolume: 118,
        opportunityTier: 'high',
        modelId: 'north-region-mama-demand-random-forest',
        modelVersion: 'forest-v1',
        generatedAt: '2026-09-10T13:00:00.000Z',
      },
    ]);
    expect(setup.modelBuilder.eq).toHaveBeenCalledWith('status', 'selected');
    expect(setup.modelBuilder.eq).toHaveBeenCalledTimes(1);
    expect(setup.importBuilder.eq).toHaveBeenCalledWith('status', 'completed');
    expect(setup.predictionBuilder.eq).toHaveBeenCalledWith('import_batch_id', 'import-1');
    // The import is loaded once and filters are applied in memory for the cached snapshot.
    expect(setup.predictionBuilder.in).not.toHaveBeenCalled();
  });

  it('reads every page of predictions beyond the PostgREST response cap', async () => {
    const row = (id: number) => ({
      id,
      operator_id: '000123',
      operator_name: null,
      treatment_line: 'advanced',
      provider_state: 'AM',
      reference_month: '2025-09-01',
      forecast_month: '2025-10-01',
      predicted_demand_volume: 10,
      observed_demand_volume: null,
      opportunity_tier: 'high',
    });
    const fullPage = Array.from({ length: PREDICTION_PAGE_SIZE }, (_, index) => row(index + 1));
    const setup = createClient();
    setup.predictionBuilder.then
      .mockImplementationOnce((resolve) =>
        Promise.resolve({ data: fullPage, error: null }).then(resolve),
      )
      .mockImplementationOnce((resolve) =>
        Promise.resolve({ data: [row(PREDICTION_PAGE_SIZE + 1)], error: null }).then(resolve),
      );
    const repository = new SupabaseDashboardRepository(setup.client);

    await expect(repository.findPredictions()).resolves.toHaveLength(PREDICTION_PAGE_SIZE + 1);
    expect(setup.predictionBuilder.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(setup.predictionBuilder.range).toHaveBeenNthCalledWith(1, 0, PREDICTION_PAGE_SIZE - 1);
    expect(setup.predictionBuilder.range).toHaveBeenNthCalledWith(
      2,
      PREDICTION_PAGE_SIZE,
      PREDICTION_PAGE_SIZE * 2 - 1,
    );
  });

  it('returns validated observed-only selected-model metadata without raw model internals', async () => {
    const setup = createClient();
    const repository = new SupabaseDashboardRepository(setup.client);

    await expect(repository.findSelectedModel()).resolves.toMatchObject({
      algorithm: 'random_forest',
      status: 'selected',
      metricScope: 'observed_only_holdout',
      trainingPeriodStart: null,
      trainingPeriodEnd: '2025-09',
      holdoutPeriodStart: '2025-10',
      holdoutPeriodEnd: '2025-12',
      metrics: { mae: 57.471, rmse: 362.961, r2: 0.802 },
    });
  });

  it('returns null for a normal missing prediction ID', async () => {
    const setup = createClient({ data: null, error: null });
    const repository = new SupabaseDashboardRepository(setup.client);

    await expect(repository.findPredictionById('999')).resolves.toBeNull();
  });
});
