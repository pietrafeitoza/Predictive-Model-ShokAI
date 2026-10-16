import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../auth/AuthContext';
import type { AuthService } from '../services/auth.service';
import { AuthPage } from './AuthPage';

function createAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    signIn: vi.fn().mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      expires_at: 1_800_000_000,
      token_type: 'bearer',
      user: { id: 'user-123', email: 'analyst@example.com' },
    }),
    signUp: vi.fn().mockResolvedValue({
      session: null,
      needsEmailConfirmation: true,
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as AuthService;
}

function renderPage(service = createAuthService()) {
  render(
    <AuthProvider service={service}>
      <AuthPage />
    </AuthProvider>,
  );
  return service;
}

describe('AuthPage', () => {
  it('starts in sign-in mode and switches between both account flows', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('validates the form before contacting Supabase', async () => {
    const user = userEvent.setup();
    const service = renderPage();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your corporate e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(service.signIn).not.toHaveBeenCalled();
  });

  it('shows and hides the password', async () => {
    const user = userEvent.setup();
    renderPage();
    const password = screen.getByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('submits valid sign-in credentials and the persistence choice', async () => {
    const user = userEvent.setup();
    const service = renderPage();

    await user.type(screen.getByLabelText('Corporate e-mail'), 'analyst@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByLabelText('Keep me signed in on this device'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(service.signIn).toHaveBeenCalledWith(
        'analyst@example.com',
        'correct-password',
      ),
    );
    expect(window.sessionStorage.getItem('shokai.auth.persistence')).toBe('session');
  });

  it('requires matching passwords when creating an account', async () => {
    const user = userEvent.setup();
    const service = renderPage();

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Corporate e-mail'), 'analyst@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.type(screen.getByLabelText('Confirm password'), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Passwords must match.')).toBeInTheDocument();
    expect(service.signUp).not.toHaveBeenCalled();
  });

  it('shows the email-confirmation state after sign-up', async () => {
    const user = userEvent.setup();
    const service = renderPage();

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Corporate e-mail'), 'analyst@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Check your e-mail to confirm your account.'),
    ).toBeInTheDocument();
    expect(service.signUp).toHaveBeenCalledWith(
      'analyst@example.com',
      'correct-password',
    );
  });

  it('shows the reason returned by Supabase when sign-up fails', async () => {
    const user = userEvent.setup();
    const service = createAuthService({
      signUp: vi.fn().mockRejectedValue(new Error('Unable to validate email address: invalid format')),
    });
    renderPage(service);

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Corporate e-mail'), 'analyst@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Unable to validate email address: invalid format'),
    ).toBeInTheDocument();
  });

  it('explains the Supabase confirmation e-mail rate limit', async () => {
    const user = userEvent.setup();
    const service = createAuthService({
      signUp: vi.fn().mockRejectedValue(new Error('email rate limit exceeded')),
    });
    renderPage(service);

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Corporate e-mail'), 'analyst@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.type(screen.getByLabelText('Confirm password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText(
        'Too many confirmation e-mails were sent. Please wait and try again.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a safe message when sign-in fails', async () => {
    const user = userEvent.setup();
    const service = createAuthService({
      signIn: vi.fn().mockRejectedValue(new Error('User does not exist')),
    });
    renderPage(service);

    await user.type(screen.getByLabelText('Corporate e-mail'), 'unknown@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('We could not sign you in. Check your e-mail and password.'),
    ).toBeInTheDocument();
  });
});
