import type { Session } from '@supabase/supabase-js';

import { mockAuthService } from './mock-auth.service';
import { getSupabaseClient } from './supabase';

export interface SignUpResult {
  session: Session | null;
  needsEmailConfirmation: boolean;
}

export interface AuthService {
  getSession(): Promise<Session | null>;
  onAuthStateChange(callback: (session: Session | null) => void): () => void;
  refreshSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
}

const supabaseAuthService: AuthService = {
  async getSession() {
    const { data, error } = await getSupabaseClient().auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  },

  onAuthStateChange(callback) {
    const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      callback(session);
    });

    return () => data.subscription.unsubscribe();
  },

  async refreshSession() {
    const { data, error } = await getSupabaseClient().auth.refreshSession();

    if (error) {
      throw error;
    }

    return data.session;
  },

  async signIn(email, password) {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data.session;
  },

  async signUp(email, password) {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return {
      session: data.session,
      needsEmailConfirmation: data.session === null,
    };
  },

  async signOut() {
    const { error } = await getSupabaseClient().auth.signOut();

    if (error) {
      throw error;
    }
  },

  async updatePassword(newPassword) {
    const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword });

    if (error) {
      throw error;
    }
  },
};

export const authService: AuthService =
  import.meta.env.VITE_DASHBOARD_DATA_SOURCE === 'mock'
    ? mockAuthService
    : supabaseAuthService;
