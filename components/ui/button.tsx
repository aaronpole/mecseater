import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  readonly size?: 'default' | 'sm' | 'lg' | 'icon';
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 select-none whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 cursor-pointer';

const variants: Readonly<Record<NonNullable<ButtonProps['variant']>, string>> = {
  default: 'bg-primary text-on-primary hover:bg-primary-hover',
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'bg-surface-elevated text-text border border-border hover:border-border-strong',
  outline: 'bg-transparent text-text border border-border hover:border-border-strong hover:bg-surface',
  ghost: 'bg-transparent text-text-secondary hover:text-text hover:bg-surface',
  destructive:
    'bg-transparent text-danger border border-danger-border hover:bg-danger-surface hover:border-danger/60',
};

const sizes: Readonly<Record<NonNullable<ButtonProps['size']>, string>> = {
  default: 'h-11 px-4',
  sm: 'h-9 px-3 text-[13px]',
  lg: 'h-12 px-6 text-base',
  icon: 'h-11 w-11 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
