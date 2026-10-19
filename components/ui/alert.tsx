import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'info' | 'success' | 'error' | 'destructive';
}

export function Alert({ className, variant = 'default', role = 'alert', ...props }: AlertProps) {
  const variants: Record<NonNullable<AlertProps['variant']>, string> = {
    default: 'border-[#262626] bg-[#141414] text-white',
    info: 'border-[#333333] bg-[#161616] text-[#e5e5e5]',
    success: 'border-[#243324] bg-[#0d140d] text-[#dcfce7]',
    error: 'border-[#3d1c1c] bg-[#170e0e] text-[#fca5a5]',
    destructive: 'border-[#3d1c1c] bg-[#170e0e] text-[#fca5a5]',
  };

  return (
    <div
      role={role}
      className={cn(
        'rounded-md border p-4 text-sm font-normal leading-relaxed transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
