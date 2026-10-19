import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 select-none font-medium text-sm transition-colors duration-150 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#090909] disabled:pointer-events-none disabled:opacity-40 cursor-pointer';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      default:
        'bg-white text-[#090909] hover:bg-[#e5e5e5] border border-white font-medium shadow-none',
      primary:
        'bg-white text-[#090909] hover:bg-[#e5e5e5] border border-white font-medium shadow-none',
      secondary:
        'bg-[#191919] text-white hover:bg-[#222222] border border-[#262626] hover:border-[#383838]',
      outline:
        'bg-transparent text-white hover:bg-[#191919] border border-[#262626] hover:border-[#404040]',
      ghost:
        'bg-transparent text-[#a3a3a3] hover:text-white hover:bg-[#191919]',
      destructive:
        'bg-[#121212] text-[#fca5a5] hover:text-[#fecaca] border border-[#3b1818] hover:border-[#7f1d1d] hover:bg-[#1a1212]',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      default: 'h-11 px-4 py-2 min-h-[44px]',
      sm: 'h-9 px-3 text-xs min-h-[36px]',
      lg: 'h-12 px-6 text-base min-h-[48px]',
      icon: 'h-11 w-11 min-h-[44px] min-w-[44px] p-0',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
