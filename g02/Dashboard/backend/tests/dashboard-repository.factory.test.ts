import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { createDefaultDashboardRepository } from '../src/repositories/dashboard-repository.factory.js';
import { MockDashboardRepository } from '../src/repositories/mock-dashboard.repository.js';
import { SupabaseDashboardRepository } from '../src/repositories/supabase-dashboard.repository.js';

describe('dashboard repository configuration', () => {
  it('keeps mock mode available without Supabase configuration', () => {
    expect(createDefaultDashboardRepository({ DASHBOARD_DATA_SOURCE: 'mock' })).toBeInstanceOf(
      MockDashboardRepository,
    );
  });

  it('fails clearly instead of silently falling back when Supabase mode is incomplete', () => {
    expect(() =>
      createDefaultDashboardRepository({
        DASHBOARD_DATA_SOURCE: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
      }),
    ).toThrow(/requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY/);
  });

  it('creates the Supabase repository when all server configuration is present', () => {
    const client = {} as SupabaseClient;
    expect(
      createDefaultDashboardRepository(
        {
          DASHBOARD_DATA_SOURCE: 'supabase',
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'publishable',
          SUPABASE_SECRET_KEY: 'secret',
        },
        client,
      ),
    ).toBeInstanceOf(SupabaseDashboardRepository);
  });
});
