import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from '../config/env.js';
import { getSupabaseAdminClient } from '../config/supabase.js';
import type { DashboardRepository } from './dashboard.repository.js';
import { MockDashboardRepository } from './mock-dashboard.repository.js';
import { SupabaseDashboardRepository } from './supabase-dashboard.repository.js';

export interface DashboardDataSourceConfig {
  DASHBOARD_DATA_SOURCE: 'mock' | 'supabase';
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

export function createDefaultDashboardRepository(
  config: DashboardDataSourceConfig = env,
  client?: SupabaseClient,
): DashboardRepository {
  if (config.DASHBOARD_DATA_SOURCE === 'mock') {
    return new MockDashboardRepository();
  }

  if (
    !config.SUPABASE_URL ||
    !config.SUPABASE_PUBLISHABLE_KEY ||
    !config.SUPABASE_SECRET_KEY
  ) {
    throw new Error(
      'Supabase dashboard mode requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY.',
    );
  }

  return new SupabaseDashboardRepository(client ?? getSupabaseAdminClient());
}
