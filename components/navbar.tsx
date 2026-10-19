'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Search, Shield } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Search', icon: Search },
    { href: '/upload', label: 'Admin', icon: Shield },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#262626] bg-[#090909]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded border border-[#333333] bg-[#141414] text-xs font-bold tracking-wider text-white">
            M
          </div>
          <span className="font-sans text-base font-semibold tracking-tight text-white group-hover:text-[#f7f7f7]">
            MECSeater
          </span>
          <span className="hidden text-[10px] font-mono uppercase tracking-widest text-[#737373] sm:inline-block">
            Seating Directory
          </span>
        </Link>

        <nav aria-label="Main Navigation" className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                  isActive
                    ? 'border border-[#383838] bg-[#191919] text-white'
                    : 'text-[#a3a3a3] hover:bg-[#141414] hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

