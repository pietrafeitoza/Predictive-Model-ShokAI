import { describe, expect, it } from 'vitest';

import { createDefaultAuthRepository } from '../src/repositories/auth-repository.factory.js';
import { MockAuthRepository } from '../src/repositories/mock-auth.repository.js';
import { SupabaseAuthRepository } from '../src/repositories/supabase-auth.repository.js';

describe('authentication repository configuration', () => {
  it('uses mock authentication without Supabase configuration in mock mode', async () => {
    const repository = createDefaultAuthRepository({ DASHBOARD_DATA_SOURCE: 'mock' });

    expect(repository).toBeInstanceOf(MockAuthRepository);
    await expect(repository.findUserByAccessToken('local-development-token')).resolves.toEqual({
      id: 'mock-dashboard-user',
      email: 'mock.user@example.com',
    });
  });

  it('fails clearly when Supabase authentication configuration is incomplete', () => {
    expect(() =>
      createDefaultAuthRepository({
        DASHBOARD_DATA_SOURCE: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
      }),
    ).toThrow(/requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY/);
  });

  it('uses Supabase authentication when its public server configuration is present', () => {
    expect(
      createDefaultAuthRepository({
        DASHBOARD_DATA_SOURCE: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'publishable',
      }),
    ).toBeInstanceOf(SupabaseAuthRepository);
  });
});
