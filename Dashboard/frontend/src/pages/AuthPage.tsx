import { type FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import { isSessionRemembered } from '../auth/auth-storage';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PasswordField } from '../components/PasswordField';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AuthMode = 'sign-in' | 'sign-up';

interface FormErrors {
  confirmPassword?: string;
  email?: string;
  password?: string;
}

function validateEmail(email: string): string | undefined {
  if (!email) return 'Enter your corporate e-mail.';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid e-mail address.';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Enter your password.';
  if (password.length < 8) return 'Use at least 8 characters.';
  return undefined;
}

function getSignUpErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    if (error.message.toLowerCase().includes('email rate limit exceeded')) {
      return 'Too many confirmation e-mails were sent. Please wait and try again.';
    }

    return error.message;
  }

  return 'We could not create your account. Please try again.';
}

export function AuthPage() {
  useDocumentTitle('Sign in · ShokAI');
  const { authNotice, initializationError, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(isSessionRemembered());
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {
      email: validateEmail(email.trim()),
      password: validatePassword(password),
    };

    if (isSignUp && password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords must match.';
    }

    return Object.fromEntries(
      Object.entries(nextErrors).filter(([, value]) => value),
    ) as FormErrors;
  }

  function switchMode() {
    setMode((currentMode) => (currentMode === 'sign-in' ? 'sign-up' : 'sign-in'));
    setPassword('');
    setConfirmPassword('');
    setErrors({});
    setSubmitError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nextErrors = validateForm();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const result = await signUp(email.trim(), password);

        if (result.needsEmailConfirmation) {
          setSuccessMessage('Check your e-mail to confirm your account.');
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        await signIn(email.trim(), password, remember);
      }
    } catch (error) {
      setSubmitError(
        isSignUp
          ? getSignUpErrorMessage(error)
          : 'We could not sign you in. Check your e-mail and password.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen animate-fade-in grid-cols-[minmax(0,1.05fr)_minmax(430px,0.95fr)] bg-paper max-lg:grid-cols-[minmax(280px,0.72fr)_minmax(430px,1fr)] max-md:block">
      <section
        aria-label="ShokAI predictive intelligence"
        className="relative min-h-[620px] overflow-hidden bg-paper max-md:min-h-[172px]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(251_252_253/52%),rgb(251_252_253/30%)_44%,rgb(251_252_253/66%))]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgb(251_252_253/6%)_34%,rgb(251_252_253/30%)_58%,rgb(251_252_253/72%)_80%,rgb(251_252_253/97%)_96%,var(--paper))] max-md:bg-[linear-gradient(180deg,rgb(251_252_253/8%),var(--paper))]" />
        <div className="relative flex min-h-screen flex-col justify-between p-14 max-lg:p-9 max-md:min-h-[172px] max-md:p-7 max-[460px]:min-h-[132px]">
          <img
            src="/assets/shokai-full-black.svg"
            alt="ShokAI"
            className="h-11 w-auto self-start max-md:h-[34px] max-[460px]:h-7"
          />
          <p className="m-0 max-w-[22ch] font-heading text-[clamp(1.75rem,3vw,2.625rem)] leading-[1.14] font-bold tracking-[-0.03em] text-navy max-md:max-w-[24ch] max-md:text-2xl max-[460px]:hidden">
            Predictive intelligence for market access operations.
          </p>
        </div>
      </section>

      <section className="flex min-w-0 flex-col justify-between gap-10 p-14 max-lg:p-9 max-md:min-h-[calc(100vh-172px)] max-md:p-6">
        <header className="flex justify-end max-md:hidden">
          <span className="font-mono text-xs tracking-[0.1em] text-muted-foreground uppercase">
            Internal access
          </span>
        </header>

        <Card className="mx-auto grid w-full max-w-[380px] animate-fade-up gap-7 ring-0 max-md:my-3 max-md:mb-7">
          <CardContent className="grid gap-5">
            <div className="grid justify-items-start gap-3">
              <img
                src="/assets/shokai-icon-black.svg"
                alt=""
                className="mb-1 h-[42px] w-auto"
              />
              <h1 className="m-0 font-heading text-3xl font-bold tracking-[-0.02em] text-navy">
                {isSignUp ? 'Create account' : 'Sign in'}
              </h1>
              <p className="m-0 text-base leading-relaxed text-muted-foreground">
                {isSignUp
                  ? 'Create your account to access the forecasting workspace.'
                  : 'Use your corporate credentials to reach the forecasting workspace.'}
              </p>
            </div>

            <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="auth-email">Corporate e-mail</Label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  value={email}
                  placeholder="name@company.com"
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'auth-email-error' : undefined}
                  onBlur={() =>
                    setErrors((current) => ({
                      ...current,
                      email: validateEmail(email.trim()),
                    }))
                  }
                  onChange={(event) => setEmail(event.target.value)}
                />
                {errors.email ? (
                  <p className="text-xs text-destructive" id="auth-email-error">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <PasswordField
                id="auth-password"
                name="password"
                label="Password"
                value={password}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                error={errors.password}
                onBlur={() =>
                  setErrors((current) => ({
                    ...current,
                    password: validatePassword(password),
                  }))
                }
                onChange={setPassword}
              />

              {isSignUp ? (
                <PasswordField
                  id="auth-confirm-password"
                  name="confirmPassword"
                  label="Confirm password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  error={errors.confirmPassword}
                  onBlur={() =>
                    setErrors((current) => ({
                      ...current,
                      confirmPassword:
                        password === confirmPassword ? undefined : 'Passwords must match.',
                    }))
                  }
                  onChange={setConfirmPassword}
                />
              ) : (
                <div className="flex min-h-10 items-center gap-2.5">
                  <Checkbox
                    id="auth-remember"
                    checked={remember}
                    aria-label="Keep me signed in on this device"
                    onCheckedChange={(checked) => setRemember(checked === true)}
                  />
                  <span className="text-sm text-grey-800">
                    Keep me signed in on this device
                  </span>
                </div>
              )}

              {initializationError ? (
                <Alert role="status" className="border-[#b9ddf3] bg-[#e6f1fa] text-[#0059a0]">
                  {initializationError}
                </Alert>
              ) : null}

              {authNotice ? (
                <Alert role="status" className="border-[#b9ddf3] bg-[#e6f1fa] text-[#0059a0]">
                  {authNotice}
                </Alert>
              ) : null}

              {submitError ? (
                <Alert variant="destructive" className="border-[#f4c5bb] bg-[#ffede8]">
                  {submitError}
                </Alert>
              ) : null}

              {successMessage ? (
                <Alert role="status" className="border-[#b7dfc1] bg-[#e8f6ec] text-[#23803c]">
                  {successMessage}
                </Alert>
              ) : null}

              <Button type="submit" disabled={isSubmitting} className="mt-0.5 h-12 w-full text-sm">
                <span>
                  {isSubmitting
                    ? isSignUp
                      ? 'Creating account…'
                      : 'Signing in…'
                    : isSignUp
                      ? 'Create account'
                      : 'Sign in'}
                </span>
                {!isSubmitting ? (
                  <ArrowRight />
                ) : (
                  <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />
                )}
              </Button>

              <p className="m-0 text-center text-sm text-muted-foreground">
                {isSignUp ? 'Already have an account?' : 'New to ShokAI?'}{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="p-1 font-semibold text-ocean hover:text-navy"
                >
                  {isSignUp ? 'Sign in' : 'Create account'}
                </button>
              </p>
            </form>
          </CardContent>
        </Card>

        <footer className="flex items-center justify-end gap-5 border-t border-border pt-5 max-lg:justify-start">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="max-[460px]:hidden">Privacy</span>
            <span className="max-[460px]:hidden">Terms</span>
            <span className="font-mono">v1.0</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
