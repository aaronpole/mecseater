import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full border-t border-[#1f1f1f] bg-[#090909] py-8 text-xs text-[#737373]">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div className="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
          <p className="font-sans font-medium text-[#a3a3a3]">
            MECSeater
          </p>
          <p className="text-[11px] text-[#737373]">
            Minimal examination hall and seating arrangement locator
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <Link
            href="/"
            className="text-[#a3a3a3] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            Search
          </Link>
          <span className="text-[#333333]">/</span>
          <Link
            href="/upload"
            className="text-[#a3a3a3] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            Admin Portal
          </Link>
        </div>
      </div>
    </footer>
  );
}

