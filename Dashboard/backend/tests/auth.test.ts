import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import type { AuthRepository } from '../src/repositories/auth.repository.js';

function createAuthRepository(
  user: Awaited<ReturnType<AuthRepository['findUserByAccessToken']>> = {
    id: 'user-123',
    email: 'analyst@example.com',
  },
): AuthRepository {
  return {
    findUserByAccessToken: vi.fn().mockResolvedValue(user),
  };
}

describe('GET /auth/me', () => {
  it('rejects requests without a bearer token', async () => {
    const response = await request(createApp({ authRepository: createAuthRepository() })).get(
      '/auth/me',
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Authentication required.' });
  });

  it('rejects malformed authorization headers', async () => {
    const response = await request(createApp({ authRepository: createAuthRepository() }))
      .get('/auth/me')
      .set('Authorization', 'Basic abc123');

    expect(response.status).toBe(401);
  });

  it('rejects invalid or expired access tokens', async () => {
    const response = await request(
      createApp({ authRepository: createAuthRepository(null) }),
    )
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });

  it('returns the authenticated user for a valid token', async () => {
    const authRepository = createAuthRepository();
    const response = await request(createApp({ authRepository }))
      .get('/auth/me')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: 'user-123',
        email: 'analyst@example.com',
      },
    });
    expect(authRepository.findUserByAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('reports unexpected repository failures as server errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const authRepository: AuthRepository = {
      findUserByAccessToken: vi.fn().mockRejectedValue(new Error('Supabase unavailable')),
    };
    const response = await request(createApp({ authRepository }))
      .get('/auth/me')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal server error.' });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
