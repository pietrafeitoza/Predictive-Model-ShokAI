import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../auth/AuthContext';
import type { AuthService } from '../../services/auth.service';
import { ProfileContent } from './ProfileContent';

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  expires_at: 1_800_000_000,
  token_type: 'bearer',
  user: {
    id: 'user-abc-123',
    email: 'analyst@example.com',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2025-01-02T03:04:05.000Z',
    last_sign_in_at: '2025-06-07T08:09:10.000Z',
    role: 'authenticated',
  },
} as Session;

function createAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    refreshSession: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(session),
    signUp: vi.fn().mockResolvedValue({ session: null, needsEmailConfirmation: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderProfile(service = createAuthService()) {
  render(
    <AuthProvider service={service}>
      <ProfileContent />
    </AuthProvider>,
  );
  return service;
}

describe('ProfileContent', () => {
  it('shows the account details from the session', async () => {
    renderProfile();

    expect(
      await screen.findByRole('heading', { name: 'analyst@example.com' }),
    ).toBeInTheDocument();
    expect(screen.getByText('user-abc-123')).toBeInTheDocument();
    expect(screen.getByText('Sign-in method')).toBeInTheDocument();
    expect(screen.getByText('Account created')).toBeInTheDocument();
  });

  it('validates the new password before submitting', async () => {
    const user = userEvent.setup();
    const service = renderProfile();
    await screen.findByRole('heading', { name: 'analyst@example.com' });

    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(screen.getByText('Enter a new password.')).toBeInTheDocument();
    expect(service.updatePassword).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText('Passwords must match.')).toBeInTheDocument();
    expect(service.updatePassword).not.toHaveBeenCalled();
  });

  it('updates the password and confirms success', async () => {
    const user = userEvent.setup();
    const service = renderProfile();
    await screen.findByRole('heading', { name: 'analyst@example.com' });

    await user.type(screen.getByLabelText('New password'), 'correct-password');
    await user.type(screen.getByLabelText('Confirm new password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(service.updatePassword).toHaveBeenCalledWith('correct-password'));
    expect(await screen.findByText('Your password has been updated.')).toBeInTheDocument();
  });

  it('shows a safe error when the password update fails', async () => {
    const user = userEvent.setup();
    const service = createAuthService({
      updatePassword: vi.fn().mockRejectedValue(new Error('Internal Supabase details')),
    });
    renderProfile(service);
    await screen.findByRole('heading', { name: 'analyst@example.com' });

    await user.type(screen.getByLabelText('New password'), 'correct-password');
    await user.type(screen.getByLabelText('Confirm new password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(
      await screen.findByText('We could not update your password. Please try again.'),
    ).toBeInTheDocument();
  });
});
