import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/app-error.js';
import type { AuthRepository } from '../repositories/auth.repository.js';
import { AuthService } from '../services/auth.service.js';

export function createRequireAuth(authRepository: AuthRepository) {
  const authService = new AuthService(authRepository);

  return async function requireAuth(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authorization = request.header('authorization');
      const match = authorization?.match(/^Bearer\s+(.+)$/i);
      const accessToken = match?.[1]?.trim();

      if (!accessToken) {
        throw new AppError('Authentication required.', 401);
      }

      request.authUser = await authService.authenticate(accessToken);
      next();
    } catch (error) {
      next(error);
    }
  };
}
