import type { AuthenticatedUser } from '../repositories/auth.repository.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export {};
