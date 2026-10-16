import { describe, expect, it } from 'vitest';

import {
  DashboardBacktestResponseSchema,
  DashboardBacktestSchema,
  DatasetCatalogResponseSchema,
  DatasetCatalogSchema,
  DashboardDistributionDimensionSchema,
  DashboardDistributionItemSchema,
  DashboardDistributionResponseSchema,
  DashboardFilterOptionsResponseSchema,
  DashboardFilterOptionsSchema,
  DashboardFiltersSchema,
  DashboardSummaryResponseSchema,
  DashboardSummarySchema,
  ModelComparisonRecordSchema,
  ModelComparisonResponseSchema,
  ModelExplainabilityResponseSchema,
  ModelMetricsSchema,
  ModelRegistryEntrySchema,
  ModelRegistryResponseSchema,
  ModelSummarySchema,
  PredictionListResponseSchema,
  PredictionRecordSchema,
  SelectedModelResponseSchema,
} from '../src/index.js';

const validMetrics = {
  mae: 12.5,
  rmse: 17.25,
  r2: -0.1,
  testRowCount: 42,
};

const validPrediction = {
  predictionId: 'prediction-001',
  operatorId: '000123',
  operatorName: null,
  treatmentLine: 'advanced',
  providerState: 'AM',
  referenceMonth: '2026-08',
  forecastMonth: '2026-09',
  predictedDemandVolume: 123.45,
  observedDemandVolume: 118,
  opportunityTier: 'high',
  modelId: 'model-001',
  modelVersion: '1.0.0',
  generatedAt: '2026-09-10T12:30:00Z',
} as const;

const validModelSummary = {
  modelId: 'model-001',
  modelVersion: '1.0.0',
  algorithm: 'random_forest',
  status: 'selected',
  targetTechnicalName: 'volume_demanda_proxy',
  targetDisplayName: 'Estimated demand volume',
  targetUnit: 'billed item quantity',
  granularity: ['operator', 'treatment_line', 'provider_state', 'month'],
  trainingPeriodStart: '2024-01',
  trainingPeriodEnd: '2025-12',
  holdoutPeriodStart: '2026-01',
  holdoutPeriodEnd: '2026-06',
  metrics: validMetrics,
  metricScope: 'observed_only_holdout',
  caveat: 'Estimated billed-item utilization demand volume.',
  generatedAt: '2026-09-10T12:30:00Z',
} as const;

const validMetadata = {
  source: 'supabase',
  generatedAt: '2026-09-10T12:30:00Z',
  modelId: 'model-001',
  modelVersion: '1.0.0',
} as const;

describe('PredictionRecordSchema', () => {
  it('accepts a valid prediction record and preserves a string operator ID', () => {
    const result = PredictionRecordSchema.parse(validPrediction);

    expect(result.operatorId).toBe('000123');
    expect(typeof result.operatorId).toBe('string');
  });

  it('rejects a negative predicted demand volume', () => {
    expect(
      PredictionRecordSchema.safeParse({ ...validPrediction, predictedDemandVolume: -1 }).success,
    ).toBe(false);
  });

  it('rejects a negative observed demand volume', () => {
    expect(
      PredictionRecordSchema.safeParse({ ...validPrediction, observedDemandVolume: -1 }).success,
    ).toBe(false);
  });

  it('rejects a provider state outside the North Region', () => {
    expect(PredictionRecordSchema.safeParse({ ...validPrediction, providerState: 'SP' }).success).toBe(
      false,
    );
  });

  it.each(['2026-1', '09-2026', '2026-13', ''])(
    'rejects the malformed month %j',
    (forecastMonth) => {
      expect(PredictionRecordSchema.safeParse({ ...validPrediction, forecastMonth }).success).toBe(
        false,
      );
    },
  );

  it('rejects an invalid ISO timestamp', () => {
    expect(PredictionRecordSchema.safeParse({ ...validPrediction, generatedAt: 'today' }).success).toBe(
      false,
    );
  });

  it('rejects a numeric operator ID instead of coercing it', () => {
    expect(PredictionRecordSchema.safeParse({ ...validPrediction, operatorId: 123 }).success).toBe(
      false,
    );
  });

  it('rejects city and verticalization fields', () => {
    expect(PredictionRecordSchema.safeParse({ ...validPrediction, city: 'Manaus' }).success).toBe(
      false,
    );
    expect(
      PredictionRecordSchema.safeParse({ ...validPrediction, verticalization: true }).success,
    ).toBe(false);
  });
});

describe('ModelMetricsSchema', () => {
  it('accepts a negative R-squared value and absent optional metrics', () => {
    const result = ModelMetricsSchema.parse(validMetrics);

    expect(result.r2).toBe(-0.1);
    expect(result.maeLog1p).toBeUndefined();
    expect(result.skillVsNaive).toBeUndefined();
  });

  it('rejects a negative MAE value', () => {
    expect(ModelMetricsSchema.safeParse({ ...validMetrics, mae: -0.01 }).success).toBe(false);
  });
});

describe('model contracts', () => {
  it('accepts a valid selected model summary', () => {
    expect(ModelSummarySchema.safeParse(validModelSummary).success).toBe(true);
  });

  it('accepts a valid model comparison record', () => {
    expect(
      ModelComparisonRecordSchema.safeParse({
        modelId: 'model-001',
        algorithm: 'random_forest',
        metrics: validMetrics,
        selected: true,
      }).success,
    ).toBe(true);
  });
});

describe('dataset catalog contracts', () => {
  const catalog = {
    sources: [
      {
        key: 'north-region-mama-data-en',
        name: 'Treated breast-cancer base',
        kind: 'processed',
        provider: 'ANS / TISS',
        description: 'Cleaned event base.',
        sensitivity: 'internal',
        updateFrequency: 'annual',
        snapshots: [
          {
            version: '2025',
            checksum: null,
            storagePath: 'data/processed/x.parquet',
            rowCount: 310340,
            columnCount: 119,
            periodStart: '2025-01-01',
            periodEnd: '2025-12-31',
            status: 'available',
            generatedAt: '2026-09-25T00:00:00.000Z',
          },
        ],
        columns: [
          {
            name: 'ID_EVENTO_ATENCAO_SAUDE',
            dataType: 'text',
            classification: 'identifier',
            origin: 'ANS/TISS',
            description: null,
          },
        ],
      },
    ],
    lineage: [
      {
        upstreamKey: 'north-region-ambulatorial-full',
        upstreamVersion: '2025',
        downstreamKey: 'north-region-mama-data-en',
        downstreamVersion: '2025',
        relation: 'cleaned_into',
        description: null,
      },
    ],
  } as const;

  it('accepts a valid dataset catalog and response envelope', () => {
    expect(DatasetCatalogSchema.safeParse(catalog).success).toBe(true);
    expect(
      DatasetCatalogResponseSchema.safeParse({ data: catalog, meta: validMetadata }).success,
    ).toBe(true);
  });

  it('rejects an unknown sensitivity and a malformed date', () => {
    expect(
      DatasetCatalogSchema.safeParse({
        ...catalog,
        sources: [{ ...catalog.sources[0], sensitivity: 'secret' }],
      }).success,
    ).toBe(false);
    expect(
      DatasetCatalogSchema.safeParse({
        ...catalog,
        sources: [
          {
            ...catalog.sources[0],
            snapshots: [{ ...catalog.sources[0].snapshots[0], periodStart: '2025/01/01' }],
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('backtest contracts', () => {
  const validBacktest = {
    rowCount: 15563,
    observedRowCount: 15067,
    predictedTotal: 1000,
    observedTotal: 1200,
    mae: 12.5,
    rmse: 30.1,
    r2: 0.42,
    byForecastMonth: [
      {
        key: '2025-10',
        label: '2025-10',
        rowCount: 5000,
        observedRowCount: 4800,
        predictedTotal: 400,
        observedTotal: 500,
        mae: 11,
        rmse: 25,
        r2: 0.4,
      },
    ],
    byTreatmentLine: [],
    byProviderState: [],
  } as const;

  it('accepts a valid backtest and a valid response envelope', () => {
    expect(DashboardBacktestSchema.safeParse(validBacktest).success).toBe(true);
    expect(
      DashboardBacktestResponseSchema.safeParse({ data: validBacktest, meta: validMetadata }).success,
    ).toBe(true);
  });

  it('accepts null metrics when there are no observed rows', () => {
    expect(
      DashboardBacktestSchema.safeParse({
        ...validBacktest,
        observedRowCount: 0,
        mae: null,
        rmse: null,
        r2: null,
      }).success,
    ).toBe(true);
  });
});

describe('model registry contracts', () => {
  const validRegistryEntry = {
    modelId: 'north-region-mama-demand-random-forest',
    modelVersion: 'forest-v1',
    algorithm: 'random_forest',
    status: 'selected',
    role: 'provisional_challenger',
    description: 'Shipped prediction base.',
    selected: true,
    deployed: false,
    hasPredictionImport: true,
    selectionRank: 1,
    targetTechnicalName: 'volume_demanda_proxy',
    targetDisplayName: 'Estimated demand volume',
    targetUnit: 'billed item quantity',
    trainingPeriodStart: '2025-02',
    trainingPeriodEnd: '2025-09',
    holdoutPeriodStart: '2025-10',
    holdoutPeriodEnd: '2025-12',
    metricScope: 'all_holdout_rows',
    selectionCriterion: 'Lowest mean validation MAE.',
    hyperparameters: { n_estimators: 600 },
    featureList: ['DEMAND_LAG_1M'],
    caveats: ['Estimated billed-item utilization demand volume.'],
    generatedAt: '2026-09-25T00:00:00.000Z',
    metrics: [
      { split: 'holdout', rowScope: 'all', metric: 'mae', value: 18.141, stdDev: null },
    ],
    validationFolds: [
      {
        originMonth: '2025-07',
        fitStartMonth: '2025-02',
        fitEndMonth: '2025-06',
        fitRows: 4238,
        validationRows: 1086,
        validationZeroShare: 0.4052,
        naiveValidationMae: 37.4705,
      },
    ],
  } as const;

  it('accepts a valid model registry entry', () => {
    expect(ModelRegistryEntrySchema.safeParse(validRegistryEntry).success).toBe(true);
  });

  it('accepts a model registry response', () => {
    expect(
      ModelRegistryResponseSchema.safeParse({ data: [validRegistryEntry], meta: validMetadata })
        .success,
    ).toBe(true);
  });

  it('accepts the extended algorithm values and rejects an unknown one', () => {
    expect(
      ModelRegistryEntrySchema.safeParse({ ...validRegistryEntry, algorithm: 'elasticnet' }).success,
    ).toBe(true);
    expect(
      ModelRegistryEntrySchema.safeParse({ ...validRegistryEntry, algorithm: 'xgboost' }).success,
    ).toBe(false);
  });
});

describe('DashboardFiltersSchema', () => {
  it('accepts unique valid filter values', () => {
    expect(
      DashboardFiltersSchema.safeParse({
        operatorIds: ['000123'],
        treatmentLines: ['advanced'],
        providerStates: ['AM'],
        forecastMonths: ['2026-09'],
        opportunityTiers: ['high'],
      }).success,
    ).toBe(true);
  });

  it.each([
    { operatorIds: [''] },
    { treatmentLines: ['maintenance'] },
    { providerStates: ['SP'] },
    { forecastMonths: ['2026-13'] },
    { opportunityTiers: ['critical'] },
  ])('rejects invalid filter values in %j', (filters) => {
    expect(DashboardFiltersSchema.safeParse(filters).success).toBe(false);
  });

  it('rejects duplicated filter values', () => {
    expect(
      DashboardFiltersSchema.safeParse({ providerStates: ['AM', 'AM'] }).success,
    ).toBe(false);
  });

  it('rejects city and verticalization filters', () => {
    expect(DashboardFiltersSchema.safeParse({ city: ['Manaus'] }).success).toBe(false);
    expect(DashboardFiltersSchema.safeParse({ verticalization: [true] }).success).toBe(false);
  });
});

describe('API response schemas', () => {
  it('requires Supabase explainability metadata to match the returned model', () => {
    const data = {
      modelId: 'forest-model',
      modelVersion: 'forest-v1',
      method: 'SHAP TreeExplainer',
      targetUnit: 'billed items per month',
      sampleSize: 1,
      holdoutSize: 2,
      expectedValue: 1,
      globalFigures: [{
        kind: 'bar',
        title: 'Impact',
        imagePath: '/assets/model-explainability/bar.png',
        alt: 'Impact chart',
        caption: 'One-row sample.',
      }],
      features: [{ name: 'DEMAND_MEAN_3M', meanAbsoluteShap: 1, sharePercent: 100 }],
      localExamples: [{
        title: 'Example',
        imagePath: '/assets/model-explainability/example.png',
        alt: 'Waterfall chart',
        caption: 'One case.',
        context: 'Holdout row',
        observed: 1,
        predicted: 1,
      }],
      limitations: ['Historical analysis only.'],
    };
    const meta = { ...validMetadata, modelId: data.modelId, modelVersion: data.modelVersion };

    expect(ModelExplainabilityResponseSchema.safeParse({ data, meta }).success).toBe(true);
    expect(ModelExplainabilityResponseSchema.safeParse({
      data,
      meta: { ...meta, modelVersion: 'forest-v2' },
    }).success).toBe(false);
  });

  it('accepts a valid prediction list response', () => {
    expect(
      PredictionListResponseSchema.safeParse({ data: [validPrediction], meta: validMetadata }).success,
    ).toBe(true);
  });

  it('accepts a valid selected model response', () => {
    expect(
      SelectedModelResponseSchema.safeParse({ data: validModelSummary, meta: validMetadata }).success,
    ).toBe(true);
  });

  it('accepts a nullable selected-model response for mock data and an empty Supabase state', () => {
    expect(
      SelectedModelResponseSchema.safeParse({
        data: null,
        meta: {
          source: 'mock',
          generatedAt: validMetadata.generatedAt,
          modelId: null,
          modelVersion: null,
        },
      }).success,
    ).toBe(true);
    expect(
      SelectedModelResponseSchema.safeParse({
        data: null,
        meta: { ...validMetadata, modelId: null, modelVersion: null },
      }).success,
    ).toBe(true);
  });

  it('rejects source metadata with model identifiers inconsistent with its source', () => {
    expect(
      PredictionListResponseSchema.safeParse({
        data: [validPrediction],
        meta: { ...validMetadata, source: 'mock' },
      }).success,
    ).toBe(false);
    expect(
      SelectedModelResponseSchema.safeParse({
        data: validModelSummary,
        meta: { ...validMetadata, modelId: null, modelVersion: null },
      }).success,
    ).toBe(false);
  });

  it('keeps the selected target as utilization volume rather than a patient measure', () => {
    const parsed = SelectedModelResponseSchema.parse({
      data: validModelSummary,
      meta: validMetadata,
    });

    expect(parsed.data?.targetTechnicalName).toBe('volume_demanda_proxy');
    expect(parsed.data?.targetUnit).toBe('billed item quantity');
    expect(parsed.data?.targetDisplayName).toBe('Estimated demand volume');
  });

  it('accepts a valid model comparison response', () => {
    expect(
      ModelComparisonResponseSchema.safeParse({
        data: [
          {
            modelId: 'model-001',
            algorithm: 'random_forest',
            metrics: validMetrics,
            selected: true,
          },
        ],
        meta: validMetadata,
      }).success,
    ).toBe(true);
  });

  it('accepts concrete dashboard summary, distribution, and filter-option responses', () => {
    const summary = {
      totalEstimatedDemandVolume: 250.5,
      predictionCount: 3,
      operatorCount: 2,
      highOpportunityRecordCount: 1,
    };
    const distribution = [
      { key: 'AM', label: 'AM', estimatedDemandVolume: 250.5, predictionCount: 3 },
    ];
    const filterOptions = {
      operators: [{ id: '000123', name: null }],
      treatmentLines: ['advanced'],
      providerStates: ['AM'],
      forecastMonths: ['2026-09'],
      opportunityTiers: ['high'],
    };

    expect(DashboardSummaryResponseSchema.safeParse({ data: summary, meta: validMetadata }).success).toBe(
      true,
    );
    expect(
      DashboardDistributionResponseSchema.safeParse({ data: distribution, meta: validMetadata })
        .success,
    ).toBe(true);
    expect(
      DashboardFilterOptionsResponseSchema.safeParse({ data: filterOptions, meta: validMetadata })
        .success,
    ).toBe(true);
  });
});

describe('dashboard aggregation contracts', () => {
  it('accepts exactly the supported distribution dimensions', () => {
    expect(DashboardDistributionDimensionSchema.options).toEqual([
      'provider_state',
      'treatment_line',
      'opportunity_tier',
      'forecast_month',
    ]);
  });

  it('validates non-negative finite summary and distribution values', () => {
    expect(
      DashboardSummarySchema.safeParse({
        totalEstimatedDemandVolume: -1,
        predictionCount: 1,
        operatorCount: 1,
        highOpportunityRecordCount: 1,
      }).success,
    ).toBe(false);
    expect(
      DashboardDistributionItemSchema.safeParse({
        key: '',
        label: 'AM',
        estimatedDemandVolume: Number.POSITIVE_INFINITY,
        predictionCount: 1.5,
      }).success,
    ).toBe(false);
  });

  it('requires unique filter options and valid shared month values', () => {
    const duplicatedOptions = {
      operators: [
        { id: '000123', name: 'Operator' },
        { id: '000123', name: null },
      ],
      treatmentLines: ['advanced', 'advanced'],
      providerStates: ['AM'],
      forecastMonths: ['2026-13'],
      opportunityTiers: ['high'],
    };

    expect(DashboardFilterOptionsSchema.safeParse(duplicatedOptions).success).toBe(false);
  });
});
