import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from './api-client';
import { createDashboardApiService } from './dashboard.service';

const meta = {
  source: 'mock',
  generatedAt: '2026-09-10T12:30:00.000Z',
  modelId: null,
  modelVersion: null,
};

describe('dashboardApiService', () => {
  it('loads and validates nullable selected-model metadata through the authenticated client', async () => {
    const response = { data: null, meta };
    const get = vi.fn().mockResolvedValue(response);
    const service = createDashboardApiService({ get } as unknown as ApiClient);

    await expect(service.getSelectedModel('access-token')).resolves.toEqual(response);
    expect(get).toHaveBeenCalledWith('/dashboard/model', 'access-token');
  });

  it('changes a model status through the authenticated client', async () => {
    const response = { data: [], meta };
    const put = vi.fn().mockResolvedValue(response);
    const service = createDashboardApiService({ get: vi.fn(), put } as unknown as ApiClient);

    await expect(
      service.setModelStatus('north-region-mama-demand-decision-tree', 'v1', 'archived', 'access-token'),
    ).resolves.toEqual(response);
    expect(put).toHaveBeenCalledWith(
      '/dashboard/models/north-region-mama-demand-decision-tree/v1/status/archived',
      'access-token',
    );
  });

  it('loads and validates protected prediction records with active filters', async () => {
    const response = {
      data: [
        {
          predictionId: 'P-1',
          operatorId: 'OP-1',
          operatorName: 'Operator One',
          treatmentLine: 'advanced',
          providerState: 'AM',
          referenceMonth: '2026-08',
          forecastMonth: '2026-09',
          predictedDemandVolume: 123.5,
          observedDemandVolume: null,
          opportunityTier: 'high',
          modelId: 'mock-model',
          modelVersion: '0.0.0',
          generatedAt: '2026-09-10T12:00:00.000Z',
        },
      ],
      meta,
    };
    const get = vi.fn().mockResolvedValue(response);
    const service = createDashboardApiService({ get } as unknown as ApiClient);

    await expect(
      service.getPredictions(
        { providerStates: ['AM'], treatmentLines: ['advanced'] },
        'access-token',
      ),
    ).resolves.toEqual(response);
    expect(get).toHaveBeenCalledWith(
      '/dashboard/predictions?treatmentLines=advanced&providerStates=AM',
      'access-token',
    );

    await service.getPredictions({}, 'access-token');
    expect(get).toHaveBeenLastCalledWith('/dashboard/predictions', 'access-token');
  });

  it('rejects malformed prediction records instead of accepting partial API data', async () => {
    const service = createDashboardApiService({
      get: vi.fn().mockResolvedValue({
        data: [{ predictionId: 'P-1', predictedDemandVolume: 'many' }],
        meta,
      }),
    } as unknown as ApiClient);

    await expect(service.getPredictions({}, 'access-token')).rejects.toThrow();
  });

  it('loads and validates filter options through the authenticated client', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        operators: [{ id: 'OP-1', name: 'Operator One' }],
        treatmentLines: ['advanced'],
        providerStates: ['AM'],
        forecastMonths: ['2026-09'],
        opportunityTiers: ['high'],
      },
      meta,
    });
    const service = createDashboardApiService({ get } as unknown as ApiClient);

    await expect(service.getFilterOptions('access-token')).resolves.toMatchObject({
      data: { providerStates: ['AM'] },
    });
    expect(get).toHaveBeenCalledWith('/dashboard/filters', 'access-token');
  });

  it('serializes only populated supported summary filters', async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        totalEstimatedDemandVolume: 12.5,
        predictionCount: 1,
        operatorCount: 1,
        highOpportunityRecordCount: 1,
      },
      meta,
    });
    const service = createDashboardApiService({ get } as unknown as ApiClient);

    await service.getSummary(
      { operatorIds: ['OP-1'], providerStates: ['AM'], opportunityTiers: ['high'] },
      'access-token',
    );

    expect(get).toHaveBeenCalledWith(
      '/dashboard/summary?operatorIds=OP-1&providerStates=AM&opportunityTiers=high',
      'access-token',
    );

    await service.getSummary({}, 'access-token');
    expect(get).toHaveBeenLastCalledWith('/dashboard/summary', 'access-token');
  });

  it.each(['provider_state', 'treatment_line', 'opportunity_tier'] as const)(
    'loads and validates the %s distribution through the authenticated client',
    async (dimension) => {
      const keys = {
        provider_state: 'AM',
        treatment_line: 'advanced',
        opportunity_tier: 'high',
      } as const;
      const get = vi.fn().mockResolvedValue({
        data: [
          {
            key: keys[dimension],
            label: keys[dimension],
            estimatedDemandVolume: 12.5,
            predictionCount: 1,
          },
        ],
        meta,
      });
      const service = createDashboardApiService({ get } as unknown as ApiClient);

      await expect(
        service.getDistribution(
          dimension,
          { forecastMonths: ['2026-09'], treatmentLines: ['advanced'] },
          'access-token',
        ),
      ).resolves.toMatchObject({ data: [{ estimatedDemandVolume: 12.5 }] });
      expect(get).toHaveBeenCalledWith(
        `/dashboard/distribution?dimension=${dimension}&treatmentLines=advanced&forecastMonths=2026-09`,
        'access-token',
      );
    },
  );

  it('omits empty distribution filters and rejects malformed distribution data', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: [], meta })
      .mockResolvedValueOnce({
        data: [{ key: 'AM', label: 'AM', estimatedDemandVolume: 'many', predictionCount: 1 }],
        meta,
      });
    const service = createDashboardApiService({ get } as unknown as ApiClient);

    await service.getDistribution('provider_state', {}, 'access-token');
    expect(get).toHaveBeenNthCalledWith(
      1,
      '/dashboard/distribution?dimension=provider_state',
      'access-token',
    );

    await expect(
      service.getDistribution('provider_state', {}, 'access-token'),
    ).rejects.toThrow();
  });

  it('rejects distribution keys outside the requested shared dimension', async () => {
    const service = createDashboardApiService({
      get: vi.fn().mockResolvedValue({
        data: [{ key: 'SP', label: 'SP', estimatedDemandVolume: 12, predictionCount: 1 }],
        meta,
      }),
    } as unknown as ApiClient);

    await expect(
      service.getDistribution('provider_state', {}, 'access-token'),
    ).rejects.toThrow();
  });

  it('rejects malformed backend data instead of silently accepting it', async () => {
    const service = createDashboardApiService({
      get: vi.fn().mockResolvedValue({ data: { predictionCount: 'many' }, meta }),
    } as unknown as ApiClient);

    await expect(service.getSummary({}, 'access-token')).rejects.toThrow();
  });
});
