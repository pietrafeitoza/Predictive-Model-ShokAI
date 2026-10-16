import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { setRememberSession } from './auth-storage';
import { clearApiCache } from '../services/api-cache';
import { authService as defaultAuthService, type AuthService } from '../services/auth.service';

interface SignUpOutcome {
  needsEmailConfirmation: boolean;
}

interface AuthContextValue {
  authNotice: string | null;
  initializationError: string | null;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  invalidateSession(message: string): Promise<void>;
  refreshSession(): Promise<Session | null>;
  signIn(email: string, password: string, remember: boolean): Promise<void>;
  signUp(email: string, password: string): Promise<SignUpOutcome>;
  signOut(): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps extends PropsWithChildren {
  service?: AuthService;
}

export function AuthProvider({ children, service = defaultAuthService }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    async function initialize() {
      try {
        const currentSession = await service.getSession();

        if (!active) return;
        setSession(currentSession);
        unsubscribe = service.onAuthStateChange((nextSession) => {
          if (active) setSession(nextSession);
        });
      } catch {
        if (active) {
          setInitializationError(
            'Authentication is not configured yet. Add the Supabase environment variables.',
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [service]);

  const signIn = useCallback(
    async (email: string, password: string, remember: boolean) => {
      setAuthNotice(null);
      setRememberSession(remember);
      clearApiCache();
      const nextSession = await service.signIn(email, password);
      setSession(nextSession);
    },
    [service],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      setAuthNotice(null);
      setRememberSession(true);
      const result = await service.signUp(email, password);

      if (result.session) setSession(result.session);

      return { needsEmailConfirmation: result.needsEmailConfirmation };
    },
    [service],
  );

  const signOut = useCallback(async () => {
    await service.signOut();
    clearApiCache();
    setSession(null);
  }, [service]);

  const refreshSession = useCallback(async () => {
    const nextSession = await service.refreshSession();
    setSession(nextSession);
    return nextSession;
  }, [service]);

  const updatePassword = useCallback(
    async (newPassword: string) => {
      await service.updatePassword(newPassword);
    },
    [service],
  );

  const invalidateSession = useCallback(
    async (message: string) => {
      try {
        await service.signOut();
      } catch {
        // A stale in-memory session must still be cleared when token revocation fails.
      } finally {
        clearApiCache();
        setSession(null);
        setAuthNotice(message);
      }
    },
    [service],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      authNotice,
      initializationError,
      invalidateSession,
      isLoading,
      refreshSession,
      session,
      user: session?.user ?? null,
      signIn,
      signOut,
      signUp,
      updatePassword,
    }),
    [
      authNotice,
      initializationError,
      invalidateSession,
      isLoading,
      refreshSession,
      session,
      signIn,
      signOut,
      signUp,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
