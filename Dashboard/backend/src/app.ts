import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import type { DashboardClock } from './controllers/dashboard.controller.js';
import { errorHandler } from './middleware/error-handler.js';
import { responseCompression } from './middleware/response-compression.js';
import type { AuthRepository } from './repositories/auth.repository.js';
import type { DashboardRepository } from './repositories/dashboard.repository.js';
import { createRouter } from './routes/index.js';

export interface CreateAppOptions {
  authRepository?: AuthRepository;
  dashboardRepository?: DashboardRepository;
  dashboardClock?: DashboardClock;
}

export function createApp(options: CreateAppOptions = {}) {
  const application = express();

  application.disable('x-powered-by');
  application.use(helmet());
  application.use(cors({ origin: env.WEB_ORIGIN }));
  application.use(express.json());
  application.use(responseCompression);
  application.use(createRouter(options));
  application.use(errorHandler);

  return application;
}

export const app = createApp();
