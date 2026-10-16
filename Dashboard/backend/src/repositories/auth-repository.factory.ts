import { env } from '../config/env.js';
import type { AuthRepository } from './auth.repository.js';
import { MockAuthRepository } from './mock-auth.repository.js';
import { SupabaseAuthRepository } from './supabase-auth.repository.js';

export interface AuthDataSourceConfig {
  DASHBOARD_DATA_SOURCE: 'mock' | 'supabase';
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
}

export function createDefaultAuthRepository(
  config: AuthDataSourceConfig = env,
): AuthRepository {
  if (config.DASHBOARD_DATA_SOURCE === 'mock') {
    return new MockAuthRepository();
  }

  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Supabase authentication requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  return new SupabaseAuthRepository();
}
