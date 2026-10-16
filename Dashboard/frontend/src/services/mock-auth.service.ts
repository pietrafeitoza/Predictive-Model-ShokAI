import type { Session, User } from '@supabase/supabase-js';

import { authStorage } from '../auth/auth-storage';
import type { AuthService } from './auth.service';

const mockSessionStorageKey = 'shokai.mock.auth.session';
const listeners = new Set<(session: Session | null) => void>();

async function readStoredSession(): Promise<Session | null> {
  const storedSession = await authStorage.getItem(mockSessionStorageKey);
  if (!storedSession) return null;

  try {
    const session = JSON.parse(storedSession) as Session;
    return session.access_token && session.user?.id ? session : null;
  } catch {
    await authStorage.removeItem(mockSessionStorageKey);
    return null;
  }
}

function createMockSession(email: string): Session {
  const issuedAt = Math.floor(Date.now() / 1000);
  const user: User = {
    id: 'mock-dashboard-user',
    app_metadata: { provider: 'mock', providers: ['mock'] },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date(issuedAt * 1000).toISOString(),
    email,
    role: 'authenticated',
  };

  return {
    access_token: 'mock-dashboard-access-token',
    refresh_token: 'mock-dashboard-refresh-token',
    expires_in: 3600,
    expires_at: issuedAt + 3600,
    token_type: 'bearer',
    user,
  };
}

async function updateSession(session: Session | null): Promise<void> {
  if (session) {
    await authStorage.setItem(mockSessionStorageKey, JSON.stringify(session));
  } else {
    await authStorage.removeItem(mockSessionStorageKey);
  }

  for (const listener of listeners) listener(session);
}

export const mockAuthService: AuthService = {
  async getSession() {
    return readStoredSession();
  },

  onAuthStateChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  async refreshSession() {
    const session = await readStoredSession();
    if (!session) return null;

    const refreshedSession = createMockSession(session.user.email ?? 'mock.user@example.com');
    await updateSession(refreshedSession);
    return refreshedSession;
  },

  async signIn(email) {
    const session = createMockSession(email);
    await updateSession(session);
    return session;
  },

  async signUp(email) {
    const session = createMockSession(email);
    await updateSession(session);
    return { session, needsEmailConfirmation: false };
  },

  async signOut() {
    await updateSession(null);
  },

  async updatePassword() {
    return undefined;
  },
};
