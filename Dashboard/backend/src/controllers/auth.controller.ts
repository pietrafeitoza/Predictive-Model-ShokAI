import type { NextFunction, Request, Response } from 'express';

export class AuthController {
  me(request: Request, response: Response, next: NextFunction): void {
    try {
      response.status(200).json({ user: request.authUser });
    } catch (error) {
      next(error);
    }
  }
}
