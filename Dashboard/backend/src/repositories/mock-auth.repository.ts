import type { AuthRepository, AuthenticatedUser } from './auth.repository.js';

const mockUser: AuthenticatedUser = Object.freeze({
  id: 'mock-dashboard-user',
  email: 'mock.user@example.com',
});

/** Development-only authentication boundary used when the dashboard runs on mock data. */
export class MockAuthRepository implements AuthRepository {
  async findUserByAccessToken(accessToken: string): Promise<AuthenticatedUser | null> {
    return accessToken.trim() ? mockUser : null;
  }
}
