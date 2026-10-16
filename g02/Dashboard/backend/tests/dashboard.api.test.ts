import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import type { AuthRepository } from '../src/repositories/auth.repository.js';
import type { DashboardRepository } from '../src/repositories/dashboard.repository.js';
import { MockDashboardRepository } from '../src/repositories/mock-dashboard.repository.js';
import { randomForestExplainability } from '../src/services/model-explainability.js';

const fixedGeneratedAt = '2026-09-10T12:30:00.000Z';

function createAuthRepository(): AuthRepository {
  return {
    findUserByAccessToken: vi.fn(async (accessToken: string) =>
      accessToken === 'valid-token'
        ? { id: 'user-123', email: 'analyst@example.com' }
        : null,
    ),
  };
}

function createTestApp(dashboardRepository: DashboardRepository = new MockDashboardRepository()) {
  return createApp({
    authRepository: createAuthRepository(),
    dashboardRepository,
    dashboardClock: () => new Date(fixedGeneratedAt),
  });
}

function authenticatedGet(app: ReturnType<typeof createTestApp>, path: string) {
  return request(app).get(path).set('Authorization', 'Bearer valid-token');
}

describe('authenticated dashboard API', () => {
  it.each([
    '/dashboard/predictions',
    '/dashboard/summary',
    '/dashboard/backtests',
    '/dashboard/distribution?dimension=provider_state',
    '/dashboard/filters',
    '/dashboard/models',
    '/dashboard/datasets',
    '/dashboard/model',
    '/dashboard/model/explainability',
  ])('rejects unauthenticated requests to %s', async (path) => {
    const response = await request(createTestApp()).get(path);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication required.' });
  });

  it('rejects an invalid bearer token with the existing authentication response', async () => {
    const response = await request(createTestApp())
      .get('/dashboard/predictions')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication required.' });
  });

  it('returns the prediction envelope for valid authentication', async () => {
    const response = await authenticatedGet(createTestApp(), '/dashboard/predictions');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(28);
    expect(response.body.data[0]).toMatchObject({ predictionId: 'MOCK-PRED-001' });
    expect(response.body.meta).toEqual({
      source: 'mock',
      generatedAt: fixedGeneratedAt,
      modelId: null,
      modelVersion: null,
    });
  });

  it('parses one filter value as a one-item array', async () => {
    const repository = new MockDashboardRepository();
    const findPredictions = vi.spyOn(repository, 'findPredictions');
    const response = await authenticatedGet(
      createTestApp(repository),
      '/dashboard/predictions?providerStates=AM',
    );

    expect(response.status).toBe(200);
    expect(
      response.body.data.every(
        ({ providerState }: { providerState: string }) => providerState === 'AM',
      ),
    ).toBe(true);
    expect(findPredictions).toHaveBeenCalledWith({ providerStates: ['AM'] });
  });

  it('uses OR semantics for repeated values in the same category', async () => {
    const response = await authenticatedGet(
      createTestApp(),
      '/dashboard/predictions?providerStates=AM&providerStates=PA&forecastMonths=2026-09',
    );

    expect(response.status).toBe(200);
    expect(
      response.body.data.map(({ predictionId }: { predictionId: string }) => predictionId),
    ).toEqual(['MOCK-PRED-001', 'MOCK-PRED-002']);
  });

  it('uses AND semantics between different filter categories', async () => {
    const response = await authenticatedGet(
      createTestApp(),
      '/dashboard/predictions?providerStates=AM&providerStates=PA&treatmentLines=advanced&forecastMonths=2026-09&forecastMonths=2026-10&opportunityTiers=high',
    );

    expect(response.status).toBe(200);
    expect(
      response.body.data.map(({ predictionId }: { predictionId: string }) => predictionId),
    ).toEqual(['MOCK-PRED-001', 'MOCK-PRED-008']);
  });

  it.each([
    '/dashboard/predictions?forecastMonths=2026-13',
    '/dashboard/predictions?providerStates=SP',
    '/dashboard/predictions?treatmentLines=maintenance',
    '/dashboard/predictions?providerStates=',
    '/dashboard/predictions?operatorIds=one,two',
    '/dashboard/predictions?city=Manaus',
  ])('rejects invalid or unsupported filters in %s', async (path) => {
    const response = await authenticatedGet(createTestApp(), path);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid dashboard query parameters.' });
  });

  it('returns summary values aggregated from filtered records', async () => {
    const response = await authenticatedGet(
      createTestApp(),
      '/dashboard/summary?forecastMonths=2026-09',
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      totalEstimatedDemandVolume: 528,
      predictionCount: 7,
      operatorCount: 4,
      highOpportunityRecordCount: 1,
    });
    expect(response.body.meta.modelId).toBeNull();
    expect(response.body.meta.modelVersion).toBeNull();
  });

  it.each([
    '/dashboard/distribution',
    '/dashboard/distribution?dimension=city',
    '/dashboard/distribution?dimension=provider_state&dimension=treatment_line',
  ])('requires exactly one supported distribution dimension in %s', async (path) => {
    const response = await authenticatedGet(createTestApp(), path);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid dashboard query parameters.' });
  });

  it('returns a filtered provider-state distribution in deterministic order', async () => {
    const response = await authenticatedGet(
      createTestApp(),
      '/dashboard/distribution?dimension=provider_state&forecastMonths=2026-09',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.map(({ key }: { key: string }) => key)).toEqual([
      'AC',
      'AM',
      'AP',
      'PA',
      'RO',
      'RR',
      'TO',
    ]);
  });

  it('returns deterministic unique filter options from the full mock dataset', async () => {
    const response = await authenticatedGet(createTestApp(), '/dashboard/filters');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      operators: [
        { id: 'MOCK-OP-001', name: 'Mock Operator Aurora' },
        { id: 'MOCK-OP-002', name: 'Mock Operator Boreal' },
        { id: 'MOCK-OP-003', name: 'Mock Operator Canopy' },
        { id: 'MOCK-OP-004', name: 'Mock Operator Delta' },
      ],
      treatmentLines: ['staging', 'neoadjuvant', 'adjuvant', 'advanced'],
      providerStates: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
      forecastMonths: ['2026-09', '2026-10', '2026-11', '2026-12'],
      opportunityTiers: ['low', 'medium', 'high'],
    });
    expect(response.body.meta).toEqual({
      source: 'mock',
      generatedAt: fixedGeneratedAt,
      modelId: null,
      modelVersion: null,
    });
  });

  it('rejects query parameters on the unfiltered options endpoint', async () => {
    const response = await authenticatedGet(
      createTestApp(),
      '/dashboard/filters?providerStates=AM',
    );

    expect(response.status).toBe(400);
  });

  it('returns no invented selected model in mock mode', async () => {
    const response = await authenticatedGet(createTestApp(), '/dashboard/model');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: null,
      meta: {
        source: 'mock',
        generatedAt: fixedGeneratedAt,
        modelId: null,
        modelVersion: null,
      },
    });
  });

  it('serves the published SHAP analysis in mock mode without assigning it to mock predictions', async () => {
    const response = await authenticatedGet(createTestApp(), '/dashboard/model/explainability');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      modelId: 'north-region-mama-demand-random-forest',
      modelVersion: 'forest-v1',
      method: 'SHAP TreeExplainer',
      sampleSize: 1000,
    });
    expect(response.body.data.globalFigures).toHaveLength(3);
    expect(response.body.data.localExamples).toHaveLength(4);
    expect(response.body.meta).toMatchObject({ source: 'mock', modelId: null, modelVersion: null });
  });

  it('withholds the published analysis for a different selected model version', async () => {
    const selectedModel = { modelId: 'north-region-mama-demand-random-forest', modelVersion: 'forest-v2' };
    const repository = {
      source: 'supabase' as const,
      findSelectedModel: vi.fn().mockResolvedValue(selectedModel),
    } as unknown as DashboardRepository;
    const response = await authenticatedGet(createTestApp(repository), '/dashboard/model/explainability');

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
    expect(response.body.meta).toMatchObject({ modelVersion: 'forest-v2' });
  });

  it('serves the published analysis when the selected Supabase model version matches', async () => {
    const selectedModel = {
      modelId: randomForestExplainability.modelId,
      modelVersion: randomForestExplainability.modelVersion,
    };
    const repository = {
      source: 'supabase' as const,
      findSelectedModel: vi.fn().mockResolvedValue(selectedModel),
    } as unknown as DashboardRepository;
    const response = await authenticatedGet(createTestApp(repository), '/dashboard/model/explainability');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(randomForestExplainability);
    expect(response.body.meta).toEqual({
      source: 'supabase',
      generatedAt: fixedGeneratedAt,
      ...selectedModel,
    });
  });

  it('returns validated selected Random Forest metadata in Supabase mode', async () => {
    const selectedModel = {
      modelId: 'north-region-mama-demand-random-forest',
      modelVersion: 'forest-v1',
      algorithm: 'random_forest' as const,
      status: 'selected' as const,
      targetTechnicalName: 'volume_demanda_proxy' as const,
      targetDisplayName: 'Estimated demand volume' as const,
      targetUnit: 'billed item quantity' as const,
      granularity: ['operator', 'treatment_line', 'provider_state', 'month'] as const,
      trainingPeriodStart: null,
      trainingPeriodEnd: '2025-09',
      holdoutPeriodStart: '2025-10',
      holdoutPeriodEnd: '2025-12',
      metrics: { mae: 57.471, rmse: 362.961, r2: 0.802 },
      metricScope: 'observed_only_holdout' as const,
      caveat: 'Estimated billed-item utilization demand volume.',
      generatedAt: '2026-09-10T11:00:00.000Z',
    };
    const repository: DashboardRepository = {
      source: 'supabase',
      findSnapshot: vi.fn().mockResolvedValue({ predictions: [], selectedModel }),
      findPredictions: vi.fn().mockResolvedValue([]),
      findPredictionById: vi.fn().mockResolvedValue(null),
      findSelectedModel: vi.fn().mockResolvedValue(selectedModel),
      findModelRegistry: vi.fn().mockResolvedValue([]),
      setModelStatus: vi.fn().mockResolvedValue(false),
      findDatasetCatalog: vi.fn().mockResolvedValue({ sources: [], lineage: [] }),
    };
    const response = await authenticatedGet(createTestApp(repository), '/dashboard/model');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(selectedModel);
    expect(response.body.meta).toEqual({
      source: 'supabase',
      generatedAt: fixedGeneratedAt,
      modelId: selectedModel.modelId,
      modelVersion: selectedModel.modelVersion,
    });
  });

  it.each([
    ['/dashboard/predictions', []],
    [
      '/dashboard/summary',
      {
        totalEstimatedDemandVolume: 0,
        predictionCount: 0,
        operatorCount: 0,
        highOpportunityRecordCount: 0,
      },
    ],
    [
      '/dashboard/backtests',
      {
        rowCount: 0,
        observedRowCount: 0,
        predictedTotal: 0,
        observedTotal: 0,
        mae: null,
        rmse: null,
        r2: null,
        byForecastMonth: [],
        byTreatmentLine: [],
        byProviderState: [],
      },
    ],
    ['/dashboard/distribution?dimension=provider_state', []],
    [
      '/dashboard/filters',
      {
        operators: [],
        treatmentLines: [],
        providerStates: [],
        forecastMonths: [],
        opportunityTiers: [],
      },
    ],
    ['/dashboard/models', []],
    ['/dashboard/datasets', { sources: [], lineage: [] }],
    ['/dashboard/model', null],
    ['/dashboard/model/explainability', null],
  ])('returns a valid empty Supabase response from %s when no model is selected', async (path, data) => {
    const repository: DashboardRepository = {
      source: 'supabase',
      findSnapshot: vi.fn().mockResolvedValue({ predictions: [], selectedModel: null }),
      findPredictions: vi.fn().mockResolvedValue([]),
      findPredictionById: vi.fn().mockResolvedValue(null),
      findSelectedModel: vi.fn().mockResolvedValue(null),
      findModelRegistry: vi.fn().mockResolvedValue([]),
      setModelStatus: vi.fn().mockResolvedValue(false),
      findDatasetCatalog: vi.fn().mockResolvedValue({ sources: [], lineage: [] }),
    };

    const response = await authenticatedGet(createTestApp(repository), path as string);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data,
      meta: {
        source: 'supabase',
        generatedAt: fixedGeneratedAt,
        modelId: null,
        modelVersion: null,
      },
    });
  });

  it('rejects unauthenticated and disallowed model status changes', async () => {
    const unauthenticated = await request(createTestApp()).put('/dashboard/models/any/v1/status/archived');
    expect(unauthenticated.status).toBe(401);

    const disallowed = await request(createTestApp())
      .put('/dashboard/models/any/v1/status/archived')
      .set('Authorization', 'Bearer valid-token');
    expect(disallowed.status).toBe(409);
    expect(disallowed.body).toEqual({
      message: 'The requested model status change is not allowed.',
    });

    const invalidStatus = await request(createTestApp())
      .put('/dashboard/models/any/v1/status/draft')
      .set('Authorization', 'Bearer valid-token');
    expect(invalidStatus.status).toBe(400);
  });

  it('preserves the health endpoint', async () => {
    const response = await request(createTestApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'shokai-api' });
  });

  it('preserves the protected authenticated-user endpoint', async () => {
    const response = await authenticatedGet(createTestApp(), '/auth/me');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { id: 'user-123', email: 'analyst@example.com' },
    });
  });

  it('uses the existing server-error response for repository failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const repository: DashboardRepository = {
      source: 'mock',
      findSnapshot: vi.fn().mockRejectedValue(new Error('Repository unavailable')),
      findPredictions: vi.fn().mockRejectedValue(new Error('Repository unavailable')),
      findPredictionById: vi.fn().mockResolvedValue(null),
      findSelectedModel: vi.fn().mockResolvedValue(null),
      findModelRegistry: vi.fn().mockResolvedValue([]),
      setModelStatus: vi.fn().mockResolvedValue(false),
      findDatasetCatalog: vi.fn().mockResolvedValue({ sources: [], lineage: [] }),
    };
    const response = await authenticatedGet(createTestApp(repository), '/dashboard/predictions');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal server error.' });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
