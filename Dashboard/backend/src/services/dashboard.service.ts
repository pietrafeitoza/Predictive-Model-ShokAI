import type {
  BacktestSlice,
  DashboardBacktest,
  DashboardDistributionDimension,
  DashboardDistributionItem,
  DashboardFilterOptions,
  DashboardFilters,
  DashboardSummary,
  DatasetCatalog,
  ModelRegistryEntry,
  ModelStatus,
  OpportunityTier,
  PredictionRecord,
  SelectedModelSummary,
  TreatmentLine,
} from '@shokai/contracts';

import type { DashboardRepository } from '../repositories/dashboard.repository.js';
import { randomForestExplainability } from './model-explainability.js';
import type { ModelExplainability } from '@shokai/contracts';

export interface DashboardServiceResult<T> {
  data: T;
  selectedModel: SelectedModelSummary | null;
}

const treatmentLineOrder: readonly TreatmentLine[] = [
  'staging',
  'neoadjuvant',
  'adjuvant',
  'advanced',
  'unknown',
];

const opportunityTierOrder: readonly OpportunityTier[] = ['low', 'medium', 'high'];

const treatmentLineLabels: Record<TreatmentLine, string> = {
  staging: 'Staging',
  neoadjuvant: 'Neoadjuvant',
  adjuvant: 'Adjuvant',
  advanced: 'Advanced',
  unknown: 'Unknown',
};

const opportunityTierLabels: Record<OpportunityTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

interface BacktestMetrics {
  rowCount: number;
  observedRowCount: number;
  predictedTotal: number;
  observedTotal: number;
  mae: number | null;
  rmse: number | null;
  r2: number | null;
}

function computeBacktestMetrics(predictions: PredictionRecord[]): BacktestMetrics {
  const observed = predictions
    .map((prediction) => ({
      predicted: prediction.predictedDemandVolume,
      observed: prediction.observedDemandVolume,
    }))
    .filter(
      (pair): pair is { predicted: number; observed: number } => typeof pair.observed === 'number',
    );
  const observedRowCount = observed.length;
  const predictedTotal = observed.reduce((total, pair) => total + pair.predicted, 0);
  const observedTotal = observed.reduce((total, pair) => total + pair.observed, 0);

  if (observedRowCount === 0) {
    return {
      rowCount: predictions.length,
      observedRowCount: 0,
      predictedTotal: 0,
      observedTotal: 0,
      mae: null,
      rmse: null,
      r2: null,
    };
  }

  let absoluteError = 0;
  let squaredError = 0;
  for (const { predicted, observed: actual } of observed) {
    const error = predicted - actual;
    absoluteError += Math.abs(error);
    squaredError += error * error;
  }

  const meanObserved = observedTotal / observedRowCount;
  const totalVariance = observed.reduce(
    (total, { observed: actual }) => total + (actual - meanObserved) ** 2,
    0,
  );

  return {
    rowCount: predictions.length,
    observedRowCount,
    predictedTotal,
    observedTotal,
    mae: absoluteError / observedRowCount,
    rmse: Math.sqrt(squaredError / observedRowCount),
    r2: totalVariance === 0 ? null : 1 - squaredError / totalVariance,
  };
}

function groupSlices(
  predictions: PredictionRecord[],
  keyOf: (prediction: PredictionRecord) => string,
  labelOf: (key: string) => string,
  compare: (left: string, right: string) => number,
): BacktestSlice[] {
  const groups = new Map<string, PredictionRecord[]>();
  for (const prediction of predictions) {
    const key = keyOf(prediction);
    const bucket = groups.get(key) ?? [];
    bucket.push(prediction);
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .map(([key, rows]) => ({ key, label: labelOf(key), ...computeBacktestMetrics(rows) }))
    .sort((left, right) => compare(left.key, right.key));
}

function buildBacktest(predictions: PredictionRecord[]): DashboardBacktest {
  const overall = computeBacktestMetrics(predictions);

  return {
    ...overall,
    byForecastMonth: groupSlices(
      predictions,
      (prediction) => prediction.forecastMonth,
      (key) => key,
      (left, right) => left.localeCompare(right),
    ),
    byTreatmentLine: groupSlices(
      predictions,
      (prediction) => prediction.treatmentLine,
      (key) => treatmentLineLabels[key as TreatmentLine],
      (left, right) =>
        treatmentLineOrder.indexOf(left as TreatmentLine) -
        treatmentLineOrder.indexOf(right as TreatmentLine),
    ),
    byProviderState: groupSlices(
      predictions,
      (prediction) => prediction.providerState,
      (key) => key,
      (left, right) => left.localeCompare(right),
    ),
  };
}

function getDistributionKey(
  prediction: PredictionRecord,
  dimension: DashboardDistributionDimension,
): string {
  switch (dimension) {
    case 'provider_state':
      return prediction.providerState;
    case 'treatment_line':
      return prediction.treatmentLine;
    case 'opportunity_tier':
      return prediction.opportunityTier;
    case 'forecast_month':
      return prediction.forecastMonth;
  }
}

function getDistributionLabel(
  key: string,
  dimension: DashboardDistributionDimension,
): string {
  switch (dimension) {
    case 'provider_state':
      return key;
    case 'treatment_line':
      return treatmentLineLabels[key as TreatmentLine];
    case 'opportunity_tier':
      return opportunityTierLabels[key as OpportunityTier];
    case 'forecast_month':
      return key;
  }
}

function compareDistributionKeys(
  left: string,
  right: string,
  dimension: DashboardDistributionDimension,
): number {
  switch (dimension) {
    case 'provider_state':
      return left.localeCompare(right);
    case 'treatment_line':
      return (
        treatmentLineOrder.indexOf(left as TreatmentLine) -
        treatmentLineOrder.indexOf(right as TreatmentLine)
      );
    case 'opportunity_tier':
      return (
        opportunityTierOrder.indexOf(left as OpportunityTier) -
        opportunityTierOrder.indexOf(right as OpportunityTier)
      );
    case 'forecast_month':
      return left.localeCompare(right);
  }
}

export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getPredictions(filters: DashboardFilters): Promise<PredictionRecord[]> {
    return (await this.getPredictionsResult(filters)).data;
  }

  async getPredictionsResult(
    filters: DashboardFilters,
  ): Promise<DashboardServiceResult<PredictionRecord[]>> {
    const snapshot = await this.dashboardRepository.findSnapshot(filters);
    return { data: snapshot.predictions, selectedModel: snapshot.selectedModel };
  }

  get source(): DashboardRepository['source'] {
    return this.dashboardRepository.source;
  }

  async getSelectedModel(): Promise<SelectedModelSummary | null> {
    return this.dashboardRepository.findSelectedModel();
  }

  async getModelRegistry(): Promise<ModelRegistryEntry[]> {
    return (await this.getModelRegistryResult()).data;
  }

  async setModelStatus(
    modelKey: string,
    version: string,
    status: ModelStatus,
  ): Promise<boolean> {
    return this.dashboardRepository.setModelStatus(modelKey, version, status);
  }

  async getModelRegistryResult(): Promise<DashboardServiceResult<ModelRegistryEntry[]>> {
    const [data, selectedModel] = await Promise.all([
      this.dashboardRepository.findModelRegistry(),
      this.dashboardRepository.findSelectedModel(),
    ]);
    return { data, selectedModel };
  }

  async getDatasetCatalog(): Promise<DatasetCatalog> {
    return (await this.getDatasetCatalogResult()).data;
  }

  async getDatasetCatalogResult(): Promise<DashboardServiceResult<DatasetCatalog>> {
    const data = await this.dashboardRepository.findDatasetCatalog();
    return { data, selectedModel: null };
  }

  async getModelExplainability(): Promise<DashboardServiceResult<ModelExplainability | null>> {
    const selectedModel = await this.dashboardRepository.findSelectedModel();
    // Mock mode presents the published analysis as a reference, not as an
    // explanation of the mock predictions. A live model must match exactly.
    const matches = selectedModel?.modelId === randomForestExplainability.modelId &&
      selectedModel?.modelVersion === randomForestExplainability.modelVersion;
    return {
      data: this.source === 'mock' || matches ? randomForestExplainability : null,
      selectedModel,
    };
  }

  async getSummary(filters: DashboardFilters): Promise<DashboardSummary> {
    return (await this.getSummaryResult(filters)).data;
  }

  async getSummaryResult(
    filters: DashboardFilters,
  ): Promise<DashboardServiceResult<DashboardSummary>> {
    const { predictions, selectedModel } = await this.dashboardRepository.findSnapshot(filters);

    return {
      data: {
        totalEstimatedDemandVolume: predictions.reduce(
          (total, prediction) => total + prediction.predictedDemandVolume,
          0,
        ),
        predictionCount: predictions.length,
        operatorCount: new Set(predictions.map(({ operatorId }) => operatorId)).size,
        highOpportunityRecordCount: predictions.filter(
          ({ opportunityTier }) => opportunityTier === 'high',
        ).length,
      },
      selectedModel,
    };
  }

  async getBacktest(filters: DashboardFilters): Promise<DashboardBacktest> {
    return (await this.getBacktestResult(filters)).data;
  }

  async getBacktestResult(
    filters: DashboardFilters,
  ): Promise<DashboardServiceResult<DashboardBacktest>> {
    const { predictions, selectedModel } = await this.dashboardRepository.findSnapshot(filters);
    return { data: buildBacktest(predictions), selectedModel };
  }

  async getDistribution(
    dimension: DashboardDistributionDimension,
    filters: DashboardFilters,
  ): Promise<DashboardDistributionItem[]> {
    return (await this.getDistributionResult(dimension, filters)).data;
  }

  async getDistributionResult(
    dimension: DashboardDistributionDimension,
    filters: DashboardFilters,
  ): Promise<DashboardServiceResult<DashboardDistributionItem[]>> {
    const { predictions, selectedModel } = await this.dashboardRepository.findSnapshot(filters);
    const groups = new Map<string, DashboardDistributionItem>();

    for (const prediction of predictions) {
      const key = getDistributionKey(prediction, dimension);
      const existingGroup = groups.get(key);

      if (existingGroup) {
        groups.set(key, {
          ...existingGroup,
          estimatedDemandVolume:
            existingGroup.estimatedDemandVolume + prediction.predictedDemandVolume,
          predictionCount: existingGroup.predictionCount + 1,
        });
      } else {
        groups.set(key, {
          key,
          label: getDistributionLabel(key, dimension),
          estimatedDemandVolume: prediction.predictedDemandVolume,
          predictionCount: 1,
        });
      }
    }

    return {
      data: [...groups.values()].sort((left, right) =>
        compareDistributionKeys(left.key, right.key, dimension),
      ),
      selectedModel,
    };
  }

  async getFilterOptions(): Promise<DashboardFilterOptions> {
    return (await this.getFilterOptionsResult()).data;
  }

  async getFilterOptionsResult(): Promise<DashboardServiceResult<DashboardFilterOptions>> {
    const { predictions, selectedModel } = await this.dashboardRepository.findSnapshot();
    const operatorsById = new Map<string, DashboardFilterOptions['operators'][number]>();

    for (const prediction of predictions) {
      if (!operatorsById.has(prediction.operatorId)) {
        operatorsById.set(prediction.operatorId, {
          id: prediction.operatorId,
          name: prediction.operatorName ?? null,
        });
      }
    }

    return {
      data: {
        operators: [...operatorsById.values()].sort((left, right) => {
          const leftDisplayName = left.name ?? left.id;
          const rightDisplayName = right.name ?? right.id;

          return leftDisplayName.localeCompare(rightDisplayName) || left.id.localeCompare(right.id);
        }),
        treatmentLines: treatmentLineOrder.filter((value) =>
          predictions.some(({ treatmentLine }) => treatmentLine === value),
        ),
        providerStates: [...new Set(predictions.map(({ providerState }) => providerState))].sort(),
        forecastMonths: [...new Set(predictions.map(({ forecastMonth }) => forecastMonth))].sort(),
        opportunityTiers: opportunityTierOrder.filter((value) =>
          predictions.some(({ opportunityTier }) => opportunityTier === value),
        ),
      },
      selectedModel,
    };
  }
}
