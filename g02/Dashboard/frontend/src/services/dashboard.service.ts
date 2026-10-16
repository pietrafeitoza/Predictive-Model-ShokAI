import {
  DashboardDistributionDimensionSchema,
  DashboardBacktestResponseSchema,
  DatasetCatalogResponseSchema,
  DashboardDistributionResponseSchema,
  DashboardFilterOptionsResponseSchema,
  DashboardFiltersSchema,
  DashboardSummaryResponseSchema,
  OpportunityTierSchema,
  PredictionListResponseSchema,
  ProviderStateSchema,
  SelectedModelResponseSchema,
  ModelExplainabilityResponseSchema,
  ModelRegistryResponseSchema,
  TreatmentLineSchema,
  YearMonthSchema,
  type DashboardBacktestResponse,
  type DatasetCatalogResponse,
  type DashboardDistributionDimension,
  type DashboardDistributionResponse,
  type DashboardFilterOptionsResponse,
  type DashboardFilters,
  type DashboardSummaryResponse,
  type PredictionListResponse,
  type SelectedModelResponse,
  type ModelExplainabilityResponse,
  type ModelRegistryResponse,
  type ModelStatus,
} from '@shokai/contracts';

import { apiClient, type ApiClient } from './api-client';

export interface DashboardApiService {
  getDistribution(
    dimension: DashboardDistributionDimension,
    filters: DashboardFilters,
    accessToken: string,
  ): Promise<DashboardDistributionResponse>;
  getFilterOptions(accessToken: string): Promise<DashboardFilterOptionsResponse>;
  getPredictions(
    filters: DashboardFilters,
    accessToken: string,
  ): Promise<PredictionListResponse>;
  getSummary(
    filters: DashboardFilters,
    accessToken: string,
  ): Promise<DashboardSummaryResponse>;
  getBacktest(
    filters: DashboardFilters,
    accessToken: string,
  ): Promise<DashboardBacktestResponse>;
  getSelectedModel(accessToken: string): Promise<SelectedModelResponse>;
  getModelExplainability(accessToken: string): Promise<ModelExplainabilityResponse>;
  getModelRegistry(accessToken: string): Promise<ModelRegistryResponse>;
  setModelStatus(
    modelKey: string,
    version: string,
    status: ModelStatus,
    accessToken: string,
  ): Promise<ModelRegistryResponse>;
  getDatasetCatalog(accessToken: string): Promise<DatasetCatalogResponse>;
}

function serializeFilters(filters: DashboardFilters): URLSearchParams {
  const parsedFilters = DashboardFiltersSchema.parse(filters);
  const query = new URLSearchParams();

  for (const [name, values] of Object.entries(parsedFilters)) {
    for (const value of values ?? []) query.append(name, value);
  }

  return query;
}

function createSummaryPath(filters: DashboardFilters): string {
  const query = serializeFilters(filters);
  const queryString = query.toString();
  return `/dashboard/summary${queryString ? `?${queryString}` : ''}`;
}

function createPredictionsPath(filters: DashboardFilters): string {
  const query = serializeFilters(filters);
  const queryString = query.toString();
  return `/dashboard/predictions${queryString ? `?${queryString}` : ''}`;
}

function createBacktestPath(filters: DashboardFilters): string {
  const query = serializeFilters(filters);
  const queryString = query.toString();
  return `/dashboard/backtests${queryString ? `?${queryString}` : ''}`;
}

function createDistributionPath(
  dimension: DashboardDistributionDimension,
  filters: DashboardFilters,
): string {
  const parsedDimension = DashboardDistributionDimensionSchema.parse(dimension);
  const query = new URLSearchParams({ dimension: parsedDimension });

  serializeFilters(filters).forEach((value, name) => query.append(name, value));

  return `/dashboard/distribution?${query.toString()}`;
}

const distributionKeySchemas = {
  provider_state: ProviderStateSchema,
  treatment_line: TreatmentLineSchema,
  opportunity_tier: OpportunityTierSchema,
  forecast_month: YearMonthSchema,
} as const;

export function createDashboardApiService(client: ApiClient): DashboardApiService {
  return {
    async getDistribution(dimension, filters, accessToken) {
      const response = await client.get<unknown>(
        createDistributionPath(dimension, filters),
        accessToken,
      );
      const parsedResponse = DashboardDistributionResponseSchema.parse(response);

      for (const item of parsedResponse.data) {
        distributionKeySchemas[dimension].parse(item.key);
      }

      return parsedResponse;
    },

    async getFilterOptions(accessToken) {
      const response = await client.get<unknown>('/dashboard/filters', accessToken);
      return DashboardFilterOptionsResponseSchema.parse(response);
    },

    async getPredictions(filters, accessToken) {
      const response = await client.get<unknown>(createPredictionsPath(filters), accessToken);
      return PredictionListResponseSchema.parse(response);
    },

    async getSummary(filters, accessToken) {
      const response = await client.get<unknown>(createSummaryPath(filters), accessToken);
      return DashboardSummaryResponseSchema.parse(response);
    },

    async getBacktest(filters, accessToken) {
      const response = await client.get<unknown>(createBacktestPath(filters), accessToken);
      return DashboardBacktestResponseSchema.parse(response);
    },

    async getSelectedModel(accessToken) {
      const response = await client.get<unknown>('/dashboard/model', accessToken);
      return SelectedModelResponseSchema.parse(response);
    },

    async getModelExplainability(accessToken) {
      const response = await client.get<unknown>('/dashboard/model/explainability', accessToken);
      return ModelExplainabilityResponseSchema.parse(response);
    },

    async getModelRegistry(accessToken) {
      const response = await client.get<unknown>('/dashboard/models', accessToken);
      return ModelRegistryResponseSchema.parse(response);
    },

    async setModelStatus(modelKey, version, status, accessToken) {
      const response = await client.put<unknown>(
        `/dashboard/models/${encodeURIComponent(modelKey)}/${encodeURIComponent(version)}/status/${encodeURIComponent(status)}`,
        accessToken,
      );
      return ModelRegistryResponseSchema.parse(response);
    },

    async getDatasetCatalog(accessToken) {
      const response = await client.get<unknown>('/dashboard/datasets', accessToken);
      return DatasetCatalogResponseSchema.parse(response);
    },
  };
}

export const dashboardApiService = createDashboardApiService(apiClient);
