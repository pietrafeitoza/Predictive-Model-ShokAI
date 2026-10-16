import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setRememberSession } from '../auth/auth-storage';
import { mockAuthService } from './mock-auth.service';

describe('mock authentication service', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    await mockAuthService.signOut();
  });

  it('creates and restores a local session without Supabase credentials', async () => {
    setRememberSession(false);

    const session = await mockAuthService.signIn('analyst@example.com', 'unused-password');

    expect(session).toMatchObject({
      access_token: 'mock-dashboard-access-token',
      user: { id: 'mock-dashboard-user', email: 'analyst@example.com' },
    });
    await expect(mockAuthService.getSession()).resolves.toMatchObject({
      access_token: 'mock-dashboard-access-token',
    });
    expect(window.sessionStorage.length).toBeGreaterThan(0);
  });

  it('notifies subscribers when signing in and out', async () => {
    const listener = vi.fn();
    const unsubscribe = mockAuthService.onAuthStateChange(listener);

    await mockAuthService.signIn('analyst@example.com', 'unused-password');
    await mockAuthService.signOut();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0][0]).toMatchObject({ user: { email: 'analyst@example.com' } });
    expect(listener.mock.calls[1][0]).toBeNull();
  });
});
