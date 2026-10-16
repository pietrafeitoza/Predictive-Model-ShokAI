import type { NextFunction, Request, Response } from 'express';

import { HealthService } from '../services/health.service.js';

export class HealthController {
  constructor(private readonly healthService = new HealthService()) {}

  show(_request: Request, response: Response, next: NextFunction): void {
    try {
      response.status(200).json(this.healthService.getStatus());
    } catch (error) {
      next(error);
    }
  }
}
