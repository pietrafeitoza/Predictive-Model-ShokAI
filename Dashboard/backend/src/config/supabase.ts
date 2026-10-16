import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from './env.js';

let supabaseAuthClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

const serverAuthOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

export function getSupabaseAuthClient(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Supabase Auth is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  supabaseAuthClient ??= createClient(
    env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY,
    serverAuthOptions,
  );

  return supabaseAuthClient;
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error(
      'Supabase Admin is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.',
    );
  }

  supabaseAdminClient ??= createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    serverAuthOptions,
  );

  return supabaseAdminClient;
}
