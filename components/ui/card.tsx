import * as React from 'react';
import { cn } from '@/lib/utils';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps): React.JSX.Element {
  return <div className={cn('rounded-lg border border-border bg-surface p-5 text-text sm:p-6', className)} {...props} />;
}

export function CardHeader({ className, ...props }: DivProps): React.JSX.Element {
  return <div className={cn('flex flex-col gap-1 pb-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return <h2 className={cn('text-base font-semibold tracking-tight text-text', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-sm text-text-secondary', className)} {...props} />;
}

export function CardContent({ className, ...props }: DivProps): React.JSX.Element {
  return <div className={cn('space-y-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps): React.JSX.Element {
  return <div className={cn('flex items-center border-t border-border-subtle pt-4', className)} {...props} />;
}
