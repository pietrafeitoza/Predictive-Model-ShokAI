import { type FormEvent, useState } from 'react';
import {
  AtSign,
  CalendarClock,
  Clock,
  Fingerprint,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import { useAuth } from '../../auth/AuthContext';
import { PasswordField } from '../PasswordField';
import { Alert } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatTimestamp(value?: string | null): string {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : dateFormatter.format(date);
}

function initialsFromEmail(email: string): string {
  const localPart = email.split('@')[0]?.trim() ?? '';
  const segments = localPart.split(/[._-]+/).filter(Boolean);

  if (segments.length > 1) {
    return `${segments[0][0] ?? ''}${segments[1][0] ?? ''}`.toUpperCase() || 'U';
  }

  return localPart.slice(0, 2).toUpperCase() || 'U';
}

interface PasswordErrors {
  confirmPassword?: string;
  newPassword?: string;
}

export function ProfileContent() {
  const { updatePassword, user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const email = user?.email ?? 'E-mail unavailable';
  const provider = user?.app_metadata?.provider ?? 'email';

  const accountFields: { icon: LucideIcon; label: string; mono?: boolean; value: string }[] = [
    { icon: AtSign, label: 'E-mail', value: email },
    { icon: Fingerprint, label: 'User ID', value: user?.id ?? 'Unavailable', mono: true },
    { icon: ShieldCheck, label: 'Sign-in method', value: provider },
    { icon: CalendarClock, label: 'Account created', value: formatTimestamp(user?.created_at) },
    { icon: Clock, label: 'Last sign in', value: formatTimestamp(user?.last_sign_in_at) },
  ];

  function validate(): PasswordErrors {
    const nextErrors: PasswordErrors = {};

    if (!newPassword) nextErrors.newPassword = 'Enter a new password.';
    else if (newPassword.length < 8) nextErrors.newPassword = 'Use at least 8 characters.';

    if (newPassword !== confirmPassword) nextErrors.confirmPassword = 'Passwords must match.';

    setErrors(nextErrors);
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (Object.keys(validate()).length > 0) return;

    setIsSubmitting(true);

    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Your password has been updated.');
    } catch {
      setSubmitError('We could not update your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="profile-account-title"
        className="grid content-start gap-6 rounded-2xl border border-border bg-white/70 p-6"
      >
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-[linear-gradient(135deg,#0a82d4,#052e5c)] text-lg font-semibold text-white">
              {initialsFromEmail(email)}
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 gap-1.5">
            <h2
              id="profile-account-title"
              className="truncate font-heading text-lg font-bold text-navy"
            >
              {email}
            </h2>
            <Badge className="w-fit border border-ocean-100 bg-ocean-50 capitalize text-ocean-700">
              {provider}
            </Badge>
          </div>
        </div>

        <dl className="grid gap-3">
          {accountFields.map((field) => {
            const Icon = field.icon;

            return (
              <div
                key={field.label}
                className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0"
              >
                <dt className="flex shrink-0 items-center gap-2 text-[0.8125rem] text-muted-foreground">
                  <Icon className="size-3.5 text-ocean-500" aria-hidden="true" />
                  {field.label}
                </dt>
                <dd
                  className={cn(
                    'truncate text-right text-[0.8125rem] font-medium text-ink',
                    field.mono && 'font-mono text-[0.75rem]',
                  )}
                  title={field.value}
                >
                  {field.value}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section
        aria-labelledby="profile-password-title"
        className="grid content-start gap-5 rounded-2xl border border-border bg-white/70 p-6"
      >
        <div className="grid gap-1">
          <h2 id="profile-password-title" className="font-heading text-lg font-bold text-navy">
            Password
          </h2>
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            Update the password used to sign in to ShokAI.
          </p>
        </div>

        <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
          <PasswordField
            id="profile-new-password"
            name="newPassword"
            label="New password"
            value={newPassword}
            autoComplete="new-password"
            error={errors.newPassword}
            onBlur={() =>
              setErrors((current) => ({
                ...current,
                newPassword:
                  !newPassword
                    ? 'Enter a new password.'
                    : newPassword.length < 8
                      ? 'Use at least 8 characters.'
                      : undefined,
              }))
            }
            onChange={setNewPassword}
          />

          <PasswordField
            id="profile-confirm-password"
            name="confirmPassword"
            label="Confirm new password"
            value={confirmPassword}
            autoComplete="new-password"
            error={errors.confirmPassword}
            onBlur={() =>
              setErrors((current) => ({
                ...current,
                confirmPassword:
                  newPassword === confirmPassword ? undefined : 'Passwords must match.',
              }))
            }
            onChange={setConfirmPassword}
          />

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

          <Button type="submit" disabled={isSubmitting} className="w-fit">
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </section>
    </div>
  );
}
