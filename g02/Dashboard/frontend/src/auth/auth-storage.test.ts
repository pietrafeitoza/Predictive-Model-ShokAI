import { describe, expect, it } from 'vitest';

import { authStorage, isSessionRemembered, setRememberSession } from './auth-storage';

describe('authStorage', () => {
  it('uses durable storage by default', () => {
    expect(isSessionRemembered()).toBe(true);

    authStorage.setItem('supabase-session', 'remembered');

    expect(window.localStorage.getItem('supabase-session')).toBe('remembered');
    expect(window.sessionStorage.getItem('supabase-session')).toBeNull();
  });

  it('uses session storage when remember me is disabled', () => {
    setRememberSession(false);
    authStorage.setItem('supabase-session', 'temporary');

    expect(isSessionRemembered()).toBe(false);
    expect(window.localStorage.getItem('supabase-session')).toBeNull();
    expect(window.sessionStorage.getItem('supabase-session')).toBe('temporary');
  });

  it('removes auth values from both stores on sign-out', () => {
    window.localStorage.setItem('supabase-session', 'local');
    window.sessionStorage.setItem('supabase-session', 'session');

    authStorage.removeItem('supabase-session');

    expect(window.localStorage.getItem('supabase-session')).toBeNull();
    expect(window.sessionStorage.getItem('supabase-session')).toBeNull();
  });
});
