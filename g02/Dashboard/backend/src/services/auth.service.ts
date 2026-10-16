import { AppError } from '../errors/app-error.js';
import type { AuthRepository, AuthenticatedUser } from '../repositories/auth.repository.js';

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    const user = await this.authRepository.findUserByAccessToken(accessToken);

    if (!user) {
      throw new AppError('Authentication required.', 401);
    }

    return user;
  }
}
