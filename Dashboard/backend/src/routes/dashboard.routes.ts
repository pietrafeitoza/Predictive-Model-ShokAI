import { Router } from 'express';

import { DashboardController, type DashboardClock } from '../controllers/dashboard.controller.js';
import { createRequireAuth } from '../middleware/require-auth.js';
import type { AuthRepository } from '../repositories/auth.repository.js';
import type { DashboardRepository } from '../repositories/dashboard.repository.js';
import { DashboardService } from '../services/dashboard.service.js';

export function createDashboardRouter(
  authRepository: AuthRepository,
  dashboardRepository: DashboardRepository,
  clock?: DashboardClock,
): Router {
  const dashboardService = new DashboardService(dashboardRepository);
  const dashboardController = new DashboardController(dashboardService, clock);
  const dashboardRouter = Router();

  dashboardRouter.use(createRequireAuth(authRepository));
  dashboardRouter.get('/predictions', dashboardController.predictions.bind(dashboardController));
  dashboardRouter.get('/summary', dashboardController.summary.bind(dashboardController));
  dashboardRouter.get('/backtests', dashboardController.backtest.bind(dashboardController));
  dashboardRouter.get('/distribution', dashboardController.distribution.bind(dashboardController));
  dashboardRouter.get('/filters', dashboardController.filterOptions.bind(dashboardController));
  dashboardRouter.get('/models', dashboardController.modelRegistry.bind(dashboardController));
  dashboardRouter.put(
    '/models/:modelKey/:version/status/:status',
    dashboardController.setModelStatus.bind(dashboardController),
  );
  dashboardRouter.get('/datasets', dashboardController.datasetCatalog.bind(dashboardController));
  dashboardRouter.get('/model', dashboardController.selectedModel.bind(dashboardController));
  dashboardRouter.get('/model/explainability', dashboardController.modelExplainability.bind(dashboardController));

  return dashboardRouter;
}
