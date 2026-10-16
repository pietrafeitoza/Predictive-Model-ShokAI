import type {
  DashboardFilters,
  PredictionRecord,
} from '@shokai/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { DashboardRepository } from '../src/repositories/dashboard.repository.js';
import { DashboardService } from '../src/services/dashboard.service.js';

const predictionDefaults = {
  referenceMonth: '2026-08',
  observedDemandVolume: null,
  modelId: 'mock-model-not-selected',
  modelVersion: '0.0.0',
  generatedAt: '2026-09-10T12:00:00Z',
} as const;

const predictions: PredictionRecord[] = [
  {
    ...predictionDefaults,
    predictionId: 'prediction-1',
    operatorId: 'operator-b',
    operatorName: 'Beta Operator',
    treatmentLine: 'advanced',
    providerState: 'PA',
    forecastMonth: '2026-10',
    predictedDemandVolume: 10,
    opportunityTier: 'high',
  },
  {
    ...predictionDefaults,
    predictionId: 'prediction-2',
    operatorId: 'operator-a',
    operatorName: 'Alpha Operator',
    treatmentLine: 'staging',
    providerState: 'AM',
    forecastMonth: '2026-09',
    predictedDemandVolume: 20,
    opportunityTier: 'low',
  },
  {
    ...predictionDefaults,
    predictionId: 'prediction-3',
    operatorId: 'operator-a',
    operatorName: 'Alpha Operator',
    treatmentLine: 'advanced',
    providerState: 'AM',
    forecastMonth: '2026-10',
    predictedDemandVolume: 30,
    opportunityTier: 'high',
  },
  {
    ...predictionDefaults,
    predictionId: 'prediction-4',
    operatorId: 'operator-c',
    operatorName: null,
    treatmentLine: 'unknown',
    providerState: 'PA',
    forecastMonth: '2026-11',
    predictedDemandVolume: 5,
    opportunityTier: 'medium',
  },
  {
    ...predictionDefaults,
    predictionId: 'prediction-5',
    operatorId: 'operator-b',
    operatorName: 'Beta Operator',
    treatmentLine: 'neoadjuvant',
    providerState: 'AP',
    forecastMonth: '2026-09',
    predictedDemandVolume: 15,
    opportunityTier: 'medium',
  },
  {
    ...predictionDefaults,
    predictionId: 'prediction-6',
    operatorId: 'operator-d',
    operatorName: 'Delta Operator',
    treatmentLine: 'adjuvant',
    providerState: 'RO',
    forecastMonth: '2026-11',
    predictedDemandVolume: 25,
    opportunityTier: 'high',
  },
];

function createRepository(records: PredictionRecord[] = predictions): DashboardRepository {
  return {
    source: 'mock',
    findSnapshot: vi.fn().mockResolvedValue({ predictions: records, selectedModel: null }),
    findPredictions: vi.fn().mockResolvedValue(records),
    findPredictionById: vi.fn().mockResolvedValue(null),
    findSelectedModel: vi.fn().mockResolvedValue(null),
    findModelRegistry: vi.fn().mockResolvedValue([]),
    setModelStatus: vi.fn().mockResolvedValue(false),
    findDatasetCatalog: vi.fn().mockResolvedValue({ sources: [], lineage: [] }),
  };
}

describe('DashboardService', () => {
  it('retrieves predictions using the provided filters without presentation changes', async () => {
    const repository = createRepository();
    const service = new DashboardService(repository);
    const filters: DashboardFilters = {
      providerStates: ['AM'],
      opportunityTiers: ['high'],
    };

    await expect(service.getPredictions(filters)).resolves.toBe(predictions);
    expect(repository.findSnapshot).toHaveBeenCalledWith(filters);
  });

  it('sums demand volume, counts records, distinct operators, and high-opportunity records', async () => {
    const service = new DashboardService(createRepository());

    await expect(service.getSummary({})).resolves.toEqual({
      totalEstimatedDemandVolume: 105,
      predictionCount: 6,
      operatorCount: 4,
      highOpportunityRecordCount: 3,
    });
  });

  it('returns a zeroed summary for an empty result', async () => {
    const service = new DashboardService(createRepository([]));

    await expect(service.getSummary({})).resolves.toEqual({
      totalEstimatedDemandVolume: 0,
      predictionCount: 0,
      operatorCount: 0,
      highOpportunityRecordCount: 0,
    });
  });

  it('aggregates provider-state distribution in alphabetical order', async () => {
    const service = new DashboardService(createRepository());

    await expect(service.getDistribution('provider_state', {})).resolves.toEqual([
      { key: 'AM', label: 'AM', estimatedDemandVolume: 50, predictionCount: 2 },
      { key: 'AP', label: 'AP', estimatedDemandVolume: 15, predictionCount: 1 },
      { key: 'PA', label: 'PA', estimatedDemandVolume: 15, predictionCount: 2 },
      { key: 'RO', label: 'RO', estimatedDemandVolume: 25, predictionCount: 1 },
    ]);
  });

  it('aggregates treatment-line distribution in domain order with English labels', async () => {
    const service = new DashboardService(createRepository());

    await expect(service.getDistribution('treatment_line', {})).resolves.toEqual([
      { key: 'staging', label: 'Staging', estimatedDemandVolume: 20, predictionCount: 1 },
      {
        key: 'neoadjuvant',
        label: 'Neoadjuvant',
        estimatedDemandVolume: 15,
        predictionCount: 1,
      },
      { key: 'adjuvant', label: 'Adjuvant', estimatedDemandVolume: 25, predictionCount: 1 },
      { key: 'advanced', label: 'Advanced', estimatedDemandVolume: 40, predictionCount: 2 },
      { key: 'unknown', label: 'Unknown', estimatedDemandVolume: 5, predictionCount: 1 },
    ]);
  });

  it('aggregates opportunity-tier distribution in low-to-high order', async () => {
    const service = new DashboardService(createRepository());

    await expect(service.getDistribution('opportunity_tier', {})).resolves.toEqual([
      { key: 'low', label: 'Low', estimatedDemandVolume: 20, predictionCount: 1 },
      { key: 'medium', label: 'Medium', estimatedDemandVolume: 20, predictionCount: 2 },
      { key: 'high', label: 'High', estimatedDemandVolume: 65, predictionCount: 3 },
    ]);
  });

  it('aggregates the forecast-month distribution in chronological order', async () => {
    const service = new DashboardService(createRepository());

    await expect(service.getDistribution('forecast_month', {})).resolves.toEqual([
      { key: '2026-09', label: '2026-09', estimatedDemandVolume: 35, predictionCount: 2 },
      { key: '2026-10', label: '2026-10', estimatedDemandVolume: 40, predictionCount: 2 },
      { key: '2026-11', label: '2026-11', estimatedDemandVolume: 30, predictionCount: 2 },
    ]);
  });

  it('returns unique filter options in deterministic domain ordering', async () => {
    const service = new DashboardService(createRepository());

    await expect(service.getFilterOptions()).resolves.toEqual({
      operators: [
        { id: 'operator-a', name: 'Alpha Operator' },
        { id: 'operator-b', name: 'Beta Operator' },
        { id: 'operator-d', name: 'Delta Operator' },
        { id: 'operator-c', name: null },
      ],
      treatmentLines: ['staging', 'neoadjuvant', 'adjuvant', 'advanced', 'unknown'],
      providerStates: ['AM', 'AP', 'PA', 'RO'],
      forecastMonths: ['2026-09', '2026-10', '2026-11'],
      opportunityTiers: ['low', 'medium', 'high'],
    });
  });

  it('does not apply filters when loading available options', async () => {
    const repository = createRepository();
    const service = new DashboardService(repository);

    await service.getFilterOptions();

    expect(repository.findSnapshot).toHaveBeenCalledWith();
  });

  it('does not mutate repository records during any aggregation', async () => {
    const immutablePredictions = Object.freeze(
      predictions.map((prediction) => Object.freeze({ ...prediction })),
    ) as unknown as PredictionRecord[];
    const originalSnapshot = JSON.parse(JSON.stringify(immutablePredictions));
    const service = new DashboardService(createRepository(immutablePredictions));

    await service.getSummary({});
    await service.getDistribution('provider_state', {});
    await service.getDistribution('treatment_line', {});
    await service.getDistribution('opportunity_tier', {});
    await service.getFilterOptions();

    expect(immutablePredictions).toEqual(originalSnapshot);
  });

  it('does not introduce unsupported patient-count or verticalization output', async () => {
    const service = new DashboardService(createRepository());
    const outputs = JSON.stringify([
      await service.getSummary({}),
      await service.getDistribution('provider_state', {}),
      await service.getFilterOptions(),
    ]);

    expect(outputs).not.toMatch(/patient|verticalization|municipality|city/i);
  });

  it('delegates the model registry to the repository without transformation', async () => {
    const repository = createRepository();
    const service = new DashboardService(repository);

    await expect(service.getModelRegistry()).resolves.toEqual([]);
    expect(repository.findModelRegistry).toHaveBeenCalledOnce();
  });

  it('delegates a model status change to the repository', async () => {
    const repository = createRepository();
    const service = new DashboardService(repository);

    await expect(service.setModelStatus('model-key', 'v1', 'archived')).resolves.toBe(false);
    expect(repository.setModelStatus).toHaveBeenCalledWith('model-key', 'v1', 'archived');
  });

  it('delegates the dataset catalog to the repository', async () => {
    const repository = createRepository();
    const service = new DashboardService(repository);

    await expect(service.getDatasetCatalog()).resolves.toEqual({ sources: [], lineage: [] });
    expect(repository.findDatasetCatalog).toHaveBeenCalledOnce();
  });

  it('computes backtest metrics on observed rows and slices them by month, line and state', async () => {
    const records: PredictionRecord[] = [
      {
        ...predictionDefaults,
        predictionId: 'backtest-a',
        operatorId: 'operator-a',
        operatorName: null,
        treatmentLine: 'advanced',
        providerState: 'AM',
        forecastMonth: '2026-09',
        predictedDemandVolume: 12,
        observedDemandVolume: 10,
        opportunityTier: 'high',
      },
      {
        ...predictionDefaults,
        predictionId: 'backtest-b',
        operatorId: 'operator-a',
        operatorName: null,
        treatmentLine: 'advanced',
        providerState: 'AM',
        forecastMonth: '2026-09',
        predictedDemandVolume: 18,
        observedDemandVolume: 20,
        opportunityTier: 'medium',
      },
      {
        ...predictionDefaults,
        predictionId: 'backtest-c',
        operatorId: 'operator-b',
        operatorName: null,
        treatmentLine: 'staging',
        providerState: 'PA',
        forecastMonth: '2026-10',
        predictedDemandVolume: 99,
        observedDemandVolume: null,
        opportunityTier: 'low',
      },
    ];
    const service = new DashboardService(createRepository(records));

    const result = await service.getBacktest({});

    expect(result.rowCount).toBe(3);
    expect(result.observedRowCount).toBe(2);
    expect(result.predictedTotal).toBe(30);
    expect(result.observedTotal).toBe(30);
    expect(result.mae).toBeCloseTo(2);
    expect(result.rmse).toBeCloseTo(2);
    expect(result.r2).toBeCloseTo(0.84);
    expect(result.byForecastMonth.map(({ key }) => key)).toEqual(['2026-09', '2026-10']);
    expect(result.byForecastMonth[1]).toMatchObject({ observedRowCount: 0, mae: null, r2: null });
    expect(result.byTreatmentLine).toEqual([
      expect.objectContaining({ key: 'staging', observedRowCount: 0, mae: null }),
      expect.objectContaining({ key: 'advanced', observedRowCount: 2, mae: 2 }),
    ]);
    expect(result.byProviderState.map(({ key }) => key)).toEqual(['AM', 'PA']);
  });
});
