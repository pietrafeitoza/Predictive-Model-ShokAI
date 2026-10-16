import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PasswordFieldProps {
  autoComplete: string;
  error?: string;
  id: string;
  label: string;
  name: string;
  onBlur(): void;
  onChange(value: string): void;
  placeholder?: string;
  value: string;
}

export function PasswordField({
  autoComplete,
  error,
  id,
  label,
  name,
  onBlur,
  onChange,
  placeholder = '••••••••••',
  value,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative flex items-center">
        <Input
          id={id}
          name={name}
          type={isVisible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          className="pr-11"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setIsVisible((visible) => !visible)}
          className="absolute right-1 text-muted-foreground hover:text-navy"
        >
          {isVisible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
