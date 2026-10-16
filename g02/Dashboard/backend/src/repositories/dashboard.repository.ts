import type {
  DashboardFilters,
  DatasetCatalog,
  ModelRegistryEntry,
  ModelStatus,
  PredictionRecord,
  SelectedModelSummary,
} from '@shokai/contracts';

export interface DashboardSnapshot {
  predictions: PredictionRecord[];
  selectedModel: SelectedModelSummary | null;
}

/** Data-source boundary used by future dashboard services. */
export interface DashboardRepository {
  readonly source: 'mock' | 'supabase';
  findSnapshot(filters?: DashboardFilters): Promise<DashboardSnapshot>;
  findPredictions(filters?: DashboardFilters): Promise<PredictionRecord[]>;
  findPredictionById(predictionId: string): Promise<PredictionRecord | null>;
  findSelectedModel(): Promise<SelectedModelSummary | null>;
  findModelRegistry(): Promise<ModelRegistryEntry[]>;
  setModelStatus(modelKey: string, version: string, status: ModelStatus): Promise<boolean>;
  findDatasetCatalog(): Promise<DatasetCatalog>;
}
