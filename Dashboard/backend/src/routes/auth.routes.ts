import { Router } from 'express';

import { AuthController } from '../controllers/auth.controller.js';
import { createRequireAuth } from '../middleware/require-auth.js';
import type { AuthRepository } from '../repositories/auth.repository.js';

export function createAuthRouter(authRepository: AuthRepository): Router {
  const authController = new AuthController();
  const authRouter = Router();

  authRouter.get(
    '/me',
    createRequireAuth(authRepository),
    authController.me.bind(authController),
  );

  return authRouter;
}
