import { Router } from 'express';

import type { DashboardClock } from '../controllers/dashboard.controller.js';
import { createDefaultAuthRepository } from '../repositories/auth-repository.factory.js';
import type { AuthRepository } from '../repositories/auth.repository.js';
import type { DashboardRepository } from '../repositories/dashboard.repository.js';
import { createDefaultDashboardRepository } from '../repositories/dashboard-repository.factory.js';
import { createAuthRouter } from './auth.routes.js';
import { createDashboardRouter } from './dashboard.routes.js';
import { healthRouter } from './health.routes.js';

export interface CreateRouterOptions {
  authRepository?: AuthRepository;
  dashboardRepository?: DashboardRepository;
  dashboardClock?: DashboardClock;
}

export function createRouter(options: CreateRouterOptions = {}): Router {
  const router = Router();
  const authRepository = options.authRepository ?? createDefaultAuthRepository();
  const dashboardRepository = options.dashboardRepository ?? createDefaultDashboardRepository();

  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(authRepository));
  router.use(
    '/dashboard',
    createDashboardRouter(authRepository, dashboardRepository, options.dashboardClock),
  );

  return router;
}
