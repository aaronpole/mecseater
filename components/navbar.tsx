'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Find seat' },
  { href: '/upload', label: 'Admin' },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border-subtle">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center rounded-sm text-text" aria-label="MECSeater home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 items-center rounded-md px-3 text-sm transition-colors',
                  isActive
                    ? 'text-text underline decoration-primary decoration-2 underline-offset-[6px]'
                    : 'text-text-secondary hover:text-text',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
