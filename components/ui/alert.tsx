import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly variant?: 'default' | 'info' | 'success' | 'error' | 'destructive';
}

const variants: Readonly<Record<NonNullable<AlertProps['variant']>, string>> = {
  default: 'border-border bg-surface text-text',
  info: 'border-border bg-surface text-text-secondary',
  success: 'border-success-border bg-success-surface text-success',
  error: 'border-danger-border bg-danger-surface text-danger',
  destructive: 'border-danger-border bg-danger-surface text-danger',
};

export function Alert({ className, variant = 'default', role = 'alert', ...props }: AlertProps): React.JSX.Element {
  return (
    <div
      role={role}
      className={cn('rounded-md border px-4 py-3 text-sm leading-relaxed', variants[variant], className)}
      {...props}
    />
  );
}
