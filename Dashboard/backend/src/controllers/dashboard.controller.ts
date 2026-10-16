import {
  DashboardDistributionDimensionSchema,
  DashboardDistributionResponseSchema,
  DashboardBacktestResponseSchema,
  DatasetCatalogResponseSchema,
  DashboardFilterOptionsResponseSchema,
  DashboardFiltersSchema,
  DashboardSummaryResponseSchema,
  PredictionListResponseSchema,
  SelectedModelResponseSchema,
  ModelExplainabilityResponseSchema,
  ModelRegistryResponseSchema,
  ModelStatusSchema,
  type DashboardFilters,
  type ResponseMetadata,
  type SelectedModelSummary,
} from '@shokai/contracts';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../errors/app-error.js';
import type { DashboardService } from '../services/dashboard.service.js';

export type DashboardClock = () => Date;

const queryValueSchema = z
  .string()
  .min(1)
  .refine((value) => !value.includes(','), 'Comma-separated values are not supported.');

const repeatedQueryValueSchema = z.preprocess(
  (value) => (typeof value === 'string' ? [value] : value),
  z.array(queryValueSchema),
);

const dashboardFilterQueryShape = {
  operatorIds: repeatedQueryValueSchema.optional(),
  treatmentLines: repeatedQueryValueSchema.optional(),
  providerStates: repeatedQueryValueSchema.optional(),
  forecastMonths: repeatedQueryValueSchema.optional(),
  opportunityTiers: repeatedQueryValueSchema.optional(),
};

const dashboardFilterQuerySchema = z.object(dashboardFilterQueryShape).strict();
const dashboardDistributionQuerySchema = z
  .object({
    ...dashboardFilterQueryShape,
    dimension: queryValueSchema,
  })
  .strict();
const emptyQuerySchema = z.object({}).strict();
const modelStatusParamsSchema = z
  .object({
    modelKey: queryValueSchema,
    version: queryValueSchema,
    status: ModelStatusSchema,
  })
  .strict();

function invalidQuery(): AppError {
  return new AppError('Invalid dashboard query parameters.', 400);
}

function parseFilters(query: Request['query']): DashboardFilters {
  const rawFilters = dashboardFilterQuerySchema.safeParse(query);

  if (!rawFilters.success) {
    throw invalidQuery();
  }

  const filters = DashboardFiltersSchema.safeParse(rawFilters.data);

  if (!filters.success) {
    throw invalidQuery();
  }

  return filters.data;
}

export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly clock: DashboardClock = () => new Date(),
  ) {}

  async predictions(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const filters = parseFilters(request.query);
      const { data, selectedModel } = await this.dashboardService.getPredictionsResult(filters);

      response.status(200).json(
        PredictionListResponseSchema.parse({
          data,
          meta: this.createMetadata(selectedModel),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async summary(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const filters = parseFilters(request.query);
      const { data, selectedModel } = await this.dashboardService.getSummaryResult(filters);

      response.status(200).json(
        DashboardSummaryResponseSchema.parse({
          data,
          meta: this.createMetadata(selectedModel),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async distribution(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const query = dashboardDistributionQuerySchema.safeParse(request.query);

      if (!query.success) {
        throw invalidQuery();
      }

      const dimension = DashboardDistributionDimensionSchema.safeParse(query.data.dimension);
      const filters = DashboardFiltersSchema.safeParse({
        operatorIds: query.data.operatorIds,
        treatmentLines: query.data.treatmentLines,
        providerStates: query.data.providerStates,
        forecastMonths: query.data.forecastMonths,
        opportunityTiers: query.data.opportunityTiers,
      });

      if (!dimension.success || !filters.success) {
        throw invalidQuery();
      }

      const { data, selectedModel } = await this.dashboardService.getDistributionResult(
        dimension.data,
        filters.data,
      );

      response.status(200).json(
        DashboardDistributionResponseSchema.parse({
          data,
          meta: this.createMetadata(selectedModel),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async filterOptions(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      if (!emptyQuerySchema.safeParse(request.query).success) {
        throw invalidQuery();
      }

      const { data, selectedModel } = await this.dashboardService.getFilterOptionsResult();

      response.status(200).json(
        DashboardFilterOptionsResponseSchema.parse({
          data,
          meta: this.createMetadata(selectedModel),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async datasetCatalog(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      if (!emptyQuerySchema.safeParse(request.query).success) {
        throw invalidQuery();
      }

      const { data, selectedModel } = await this.dashboardService.getDatasetCatalogResult();

      response.status(200).json(
        DatasetCatalogResponseSchema.parse({
          data,
          meta: this.createMetadata(selectedModel),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async backtest(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const filters = parseFilters(request.query);
      const { data, selectedModel } = await this.dashboardService.getBacktestResult(filters);

      response.status(200).json(
        DashboardBacktestResponseSchema.parse({
          data,
          meta: this.createMetadata(selectedModel),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async modelRegistry(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      if (!emptyQuerySchema.safeParse(request.query).success) {
        throw invalidQuery();
      }

      const { data, selectedModel } = await this.dashboardService.getModelRegistryResult();

      response.status(200).json(
        ModelRegistryResponseSchema.parse({
          data,
          meta: this.createMetadata(selectedModel),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async setModelStatus(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const params = modelStatusParamsSchema.safeParse(request.params);
      if (!params.success) {
        throw invalidQuery();
      }

      const updated = await this.dashboardService.setModelStatus(
        params.data.modelKey,
        params.data.version,
        params.data.status,
      );

      if (!updated) {
        throw new AppError('The requested model status change is not allowed.', 409);
      }

      const { data, selectedModel } = await this.dashboardService.getModelRegistryResult();

      response.status(200).json(
        ModelRegistryResponseSchema.parse({
          data,
          meta: this.createMetadata(selectedModel),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async selectedModel(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      if (!emptyQuerySchema.safeParse(request.query).success) {
        throw invalidQuery();
      }

      const data = await this.dashboardService.getSelectedModel();

      response.status(200).json(
        SelectedModelResponseSchema.parse({
          data,
          meta: this.createMetadata(data),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  async modelExplainability(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      if (!emptyQuerySchema.safeParse(request.query).success) throw invalidQuery();
      const { data, selectedModel } = await this.dashboardService.getModelExplainability();
      response.status(200).json(ModelExplainabilityResponseSchema.parse({
        data,
        meta: this.createMetadata(selectedModel),
      }));
    } catch (error) {
      next(error);
    }
  }

  private createMetadata(selectedModel: SelectedModelSummary | null): ResponseMetadata {
    const generatedAt = this.clock().toISOString();

    if (this.dashboardService.source === 'mock') {
      return { source: 'mock', generatedAt, modelId: null, modelVersion: null };
    }

    if (!selectedModel) {
      return { source: 'supabase', generatedAt, modelId: null, modelVersion: null };
    }

    return {
      source: 'supabase',
      generatedAt,
      modelId: selectedModel.modelId,
      modelVersion: selectedModel.modelVersion,
    };
  }
}
