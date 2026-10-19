import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 min-h-[44px] w-full rounded-md border border-[#262626] bg-[#111111] px-3.5 py-2 text-sm text-white placeholder:text-[#737373] transition-colors duration-150 outline-none hover:border-[#383838] focus-visible:border-white focus-visible:ring-1 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#141414] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
