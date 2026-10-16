import { Router } from 'express';

import { HealthController } from '../controllers/health.controller.js';

const healthController = new HealthController();

export const healthRouter = Router();

healthRouter.get('/', healthController.show.bind(healthController));
