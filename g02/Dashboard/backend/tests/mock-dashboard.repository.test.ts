import { PredictionRecordSchema, type DashboardFilters } from '@shokai/contracts';
import { describe, expect, it } from 'vitest';

import { dashboardPredictions } from '../src/mocks/dashboard-predictions.js';
import { MockDashboardRepository } from '../src/repositories/mock-dashboard.repository.js';

const repository = new MockDashboardRepository();

describe('MockDashboardRepository', () => {
  it('returns all mock predictions when filters are omitted', async () => {
    await expect(repository.findPredictions()).resolves.toHaveLength(28);
  });

  it('returns new arrays and defensive record copies', async () => {
    const first = await repository.findPredictions();
    const second = await repository.findPredictions();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });

  it('returns only records matching one provider state', async () => {
    const results = await repository.findPredictions({ providerStates: ['AM'] });

    expect(results).not.toHaveLength(0);
    expect(results.every(({ providerState }) => providerState === 'AM')).toBe(true);
  });

  it('supports multiple provider states with OR semantics', async () => {
    const results = await repository.findPredictions({ providerStates: ['AM', 'PA'] });

    expect(results).not.toHaveLength(0);
    expect(results.every(({ providerState }) => ['AM', 'PA'].includes(providerState))).toBe(true);
    expect(new Set(results.map(({ providerState }) => providerState))).toEqual(new Set(['AM', 'PA']));
  });

  it('filters by treatment line', async () => {
    const results = await repository.findPredictions({ treatmentLines: ['advanced'] });

    expect(results.every(({ treatmentLine }) => treatmentLine === 'advanced')).toBe(true);
  });

  it('filters by forecast month', async () => {
    const results = await repository.findPredictions({ forecastMonths: ['2026-11'] });

    expect(results).toHaveLength(7);
    expect(results.every(({ forecastMonth }) => forecastMonth === '2026-11')).toBe(true);
  });

  it('filters by opportunity tier', async () => {
    const results = await repository.findPredictions({ opportunityTiers: ['high'] });

    expect(results).not.toHaveLength(0);
    expect(results.every(({ opportunityTier }) => opportunityTier === 'high')).toBe(true);
  });

  it('filters by operator ID', async () => {
    const results = await repository.findPredictions({ operatorIds: ['MOCK-OP-003'] });

    expect(results).not.toHaveLength(0);
    expect(results.every(({ operatorId }) => operatorId === 'MOCK-OP-003')).toBe(true);
  });

  it('combines different filter categories with AND semantics', async () => {
    const results = await repository.findPredictions({
      providerStates: ['AM', 'PA'],
      treatmentLines: ['advanced'],
      forecastMonths: ['2026-09', '2026-10'],
      opportunityTiers: ['high'],
    });

    expect(results.map(({ predictionId }) => predictionId)).toEqual([
      'MOCK-PRED-001',
      'MOCK-PRED-008',
    ]);
  });

  it('does not mutate the caller filter object', async () => {
    const filters = Object.freeze({
      providerStates: Object.freeze(['PA', 'AM']),
      treatmentLines: Object.freeze(['advanced']),
    }) as unknown as DashboardFilters;

    await repository.findPredictions(filters);

    expect(filters).toEqual({
      providerStates: ['PA', 'AM'],
      treatmentLines: ['advanced'],
    });
  });

  it('returns an empty array when no record matches', async () => {
    await expect(
      repository.findPredictions({
        operatorIds: ['MOCK-OP-001'],
        providerStates: ['TO'],
      }),
    ).resolves.toEqual([]);
  });

  it('rejects an invalid provider state', async () => {
    const filters = { providerStates: ['SP'] } as unknown as DashboardFilters;

    await expect(repository.findPredictions(filters)).rejects.toThrow();
  });

  it('rejects an invalid month', async () => {
    const filters = { forecastMonths: ['2026-13'] } as unknown as DashboardFilters;

    await expect(repository.findPredictions(filters)).rejects.toThrow();
  });

  it('rejects null instead of treating it as omitted filters', async () => {
    await expect(
      repository.findPredictions(null as unknown as DashboardFilters),
    ).rejects.toThrow();
  });

  it('preserves deterministic default ordering', async () => {
    const results = await repository.findPredictions();
    const expected = [...results].sort(
      (left, right) =>
        left.forecastMonth.localeCompare(right.forecastMonth) ||
        right.predictedDemandVolume - left.predictedDemandVolume ||
        left.operatorId.localeCompare(right.operatorId) ||
        left.predictionId.localeCompare(right.predictionId),
    );

    expect(results).toEqual(expected);
  });

  it('finds an existing prediction by ID and returns a defensive copy', async () => {
    const first = await repository.findPredictionById('MOCK-PRED-001');
    const second = await repository.findPredictionById('MOCK-PRED-001');

    expect(first).toMatchObject({
      predictionId: 'MOCK-PRED-001',
      operatorId: 'MOCK-OP-001',
    });
    expect(first).not.toBe(second);
  });

  it('returns null for an unknown prediction ID', async () => {
    await expect(repository.findPredictionById('MOCK-PRED-999')).resolves.toBeNull();
  });

  it('validates the complete mock fixture against the shared prediction contract', () => {
    expect(PredictionRecordSchema.array().safeParse(dashboardPredictions).success).toBe(true);
  });

  it('rejects an invalid fixture when constructing the repository', () => {
    expect(
      () => new MockDashboardRepository([{ ...dashboardPredictions[0], predictedDemandVolume: -1 }]),
    ).toThrow();
  });

  it('does not expose city or verticalization fields', () => {
    for (const prediction of dashboardPredictions) {
      expect(prediction).not.toHaveProperty('city');
      expect(prediction).not.toHaveProperty('municipality');
      expect(prediction).not.toHaveProperty('verticalization');
    }
  });

  it('does not contain literal patient-count terminology', () => {
    expect(JSON.stringify(dashboardPredictions)).not.toMatch(/predicted patients|patient count/i);
  });

  it('does not identify a candidate algorithm as selected', () => {
    const serializedFixture = JSON.stringify(dashboardPredictions);

    expect(serializedFixture).not.toMatch(/decision_tree|linear_regression|random_forest/);
    expect(new Set(dashboardPredictions.map(({ modelId }) => modelId))).toEqual(
      new Set(['mock-model-not-selected']),
    );
  });
});
