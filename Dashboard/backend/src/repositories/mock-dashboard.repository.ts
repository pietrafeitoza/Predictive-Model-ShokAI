import {
  DashboardFiltersSchema,
  PredictionRecordSchema,
  type DashboardFilters,
  type DatasetCatalog,
  type ModelRegistryEntry,
  type PredictionRecord,
} from '@shokai/contracts';

import { dashboardPredictions } from '../mocks/dashboard-predictions.js';
import type { DashboardRepository, DashboardSnapshot } from './dashboard.repository.js';
import { comparePredictions } from './prediction-order.js';

function clonePrediction(prediction: PredictionRecord): PredictionRecord {
  return { ...prediction };
}

export class MockDashboardRepository implements DashboardRepository {
  readonly source = 'mock' as const;
  private readonly predictions: readonly PredictionRecord[];

  constructor(predictions: unknown = dashboardPredictions) {
    const validatedPredictions = PredictionRecordSchema.array().parse(predictions);
    this.predictions = Object.freeze(
      validatedPredictions.sort(comparePredictions).map((prediction) => Object.freeze(prediction)),
    );
  }

  async findPredictions(filters?: DashboardFilters): Promise<PredictionRecord[]> {
    const validatedFilters = DashboardFiltersSchema.parse(filters === undefined ? {} : filters);

    return this.predictions
      .filter(
        (prediction) =>
          (validatedFilters.operatorIds === undefined ||
            validatedFilters.operatorIds.includes(prediction.operatorId)) &&
          (validatedFilters.treatmentLines === undefined ||
            validatedFilters.treatmentLines.includes(prediction.treatmentLine)) &&
          (validatedFilters.providerStates === undefined ||
            validatedFilters.providerStates.includes(prediction.providerState)) &&
          (validatedFilters.forecastMonths === undefined ||
            validatedFilters.forecastMonths.includes(prediction.forecastMonth)) &&
          (validatedFilters.opportunityTiers === undefined ||
            validatedFilters.opportunityTiers.includes(prediction.opportunityTier)),
      )
      .map(clonePrediction);
  }

  async findSnapshot(filters?: DashboardFilters): Promise<DashboardSnapshot> {
    return {
      predictions: await this.findPredictions(filters),
      selectedModel: null,
    };
  }

  async findPredictionById(predictionId: string): Promise<PredictionRecord | null> {
    const prediction = this.predictions.find((candidate) => candidate.predictionId === predictionId);
    return prediction === undefined ? null : clonePrediction(prediction);
  }

  async findSelectedModel(): Promise<null> {
    return null;
  }

  // Mock mode must not invent model metadata; the registry is a Supabase-only view.
  async findModelRegistry(): Promise<ModelRegistryEntry[]> {
    return [];
  }

  // The dataset catalog is also a Supabase-only view.
  async findDatasetCatalog(): Promise<DatasetCatalog> {
    return { sources: [], lineage: [] };
  }

  // Changing a model status writes to the registry, which mock mode must not do.
  async setModelStatus(): Promise<boolean> {
    return false;
  }
}
