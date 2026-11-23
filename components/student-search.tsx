'use client';

import { FormEvent, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { readSearchResponse } from '@/lib/search/response';
import { cn } from '@/lib/utils';

type SearchResult = {
  readonly name: string;
  readonly roll_no: string;
  readonly room_no: string;
  readonly seat_no: string;
};

type SearchState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly term: string }
  | { readonly kind: 'done'; readonly term: string; readonly results: readonly SearchResult[] }
  | { readonly kind: 'error'; readonly term: string; readonly message: string };

/**
 * Rooms are usually three digits ("107") and seats "A01", but a hall can be named
 * ("Seminar Hall"). Step the condensed figure down with length so it stays as large
 * as possible without breaking mid-word on a 320px phone.
 */
const SHORT_FIGURE_LENGTH = 4;
const MEDIUM_FIGURE_LENGTH = 7;
const FIGURE_SIZES: ReadonlyArray<{ readonly maxLength: number; readonly className: string }> = [
  { maxLength: SHORT_FIGURE_LENGTH, className: 'text-[clamp(4rem,21vw,5.5rem)]/[0.85] sm:text-[7.5rem]/[0.85]' },
  { maxLength: MEDIUM_FIGURE_LENGTH, className: 'text-[clamp(2.5rem,12vw,3.25rem)]/[0.9] sm:text-[4.5rem]/[0.9]' },
  { maxLength: Number.POSITIVE_INFINITY, className: 'text-[2.25rem]/[1] sm:text-[2.75rem]/[1]' },
];
const PLACEHOLDER = '—';
const SKELETON_CELLS = 10;

function figureSize(value: string): string {
  return FIGURE_SIZES.find((size) => value.length <= size.maxLength)?.className ?? '';
}

/** Seating PDFs print names in capitals; "RUKSANA M A" reads better as "Ruksana M A". */
function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StudentSearch(): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    setState({ kind: 'loading', term });
    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(term)}`);
      const results = await readSearchResponse(response);
      setState({ kind: 'done', term, results });
    } catch (error) {
      setState({ kind: 'error', term, message: error instanceof Error ? error.message : 'Search failed.' });
    }
  }

  function handleClear(): void {
    setQuery('');
    setState({ kind: 'idle' });
    inputRef.current?.focus();
  }

  const isLoading = state.kind === 'loading';

  return (
    <div>
      <h1 className="text-balance font-semicondensed text-[2.75rem]/[0.95] font-bold tracking-[-0.025em] sm:text-[4rem]/[0.95]">
        Find your exam seat
      </h1>
      <p className="mt-4 max-w-[42ch] text-[1.0625rem] leading-relaxed text-text-secondary">
        Enter your roll number or name. You&rsquo;ll get your room and seat number.
      </p>

      <form role="search" onSubmit={handleSubmit} className="mt-8">
        <label htmlFor="seat-query" className="sr-only">
          Roll number or name
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              id="seat-query"
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="MDL24CS001"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-14 w-full rounded-md border-[1.5px] border-border-strong bg-surface pl-4 pr-12 text-lg text-text outline-none transition-[border-color,box-shadow] placeholder:text-muted hover:border-text-secondary focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_18%,transparent)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" disabled={isLoading || !query.trim()} className="h-14 shrink-0 rounded-md px-5 text-base">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Finding seat" /> : 'Find seat'}
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted">A full roll number gives one exact match. Part of a name works too.</p>
      </form>

      <div aria-live="polite" aria-busy={isLoading} className="mt-10">
        <SearchOutcome state={state} />
      </div>
    </div>
  );
}

type OutcomeRenderers = {
  readonly [Kind in SearchState['kind']]: (state: Extract<SearchState, { kind: Kind }>) => React.JSX.Element | null;
};

const outcomeRenderers: OutcomeRenderers = {
  idle: () => null,
  loading: () => <SeatSheetSkeleton />,
  error: (state) => (
    <Alert variant="error">
      <p className="font-medium">Search didn&rsquo;t go through</p>
      <p className="mt-0.5 opacity-85">{state.message}</p>
    </Alert>
  ),
  done: (state) =>
    state.results.length === 0 ? (
      <div className="border-l-2 border-border-strong pl-4">
        <p className="font-medium">No seat found for &ldquo;{state.term}&rdquo;</p>
        <p className="mt-1 text-sm text-text-secondary">
          Check the spelling, or search with your full roll number instead.
        </p>
      </div>
    ) : (
      <ResultList results={state.results} />
    ),
};

function SearchOutcome({ state }: { readonly state: SearchState }): React.JSX.Element | null {
  const render = outcomeRenderers[state.kind] as (current: SearchState) => React.JSX.Element | null;
  return render(state);
}

function ResultList({ results }: { readonly results: readonly SearchResult[] }): React.JSX.Element {
  return (
    <section aria-label="Seat results">
      {results.length > 1 && (
        <p className="mb-4 text-sm text-text-secondary">
          {results.length} students match. Look for your roll number.
        </p>
      )}
      <ul className="space-y-5">
        {results.map((result, index) => (
          <li key={`${result.roll_no}-${result.seat_no}-${index}`}>
            <SeatSheet result={result} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One student's allocation, laid out like the front of an answer booklet. */
function SeatSheet({ result }: { readonly result: SearchResult }): React.JSX.Element {
  return (
    <article className="rounded-[5px] border border-border bg-surface">
      <header className="px-5 pb-5 pt-5 sm:px-6">
        <h2 className="text-[1.1875rem] font-semibold leading-snug">
          {result.name ? toTitleCase(result.name) : 'Unnamed student'}
        </h2>
        <RegisterNumber value={result.roll_no} />
      </header>
      <dl className="grid grid-cols-2 border-t border-border">
        <SeatFigure label="Room" value={result.room_no} />
        <SeatFigure label="Seat" value={result.seat_no} className="border-l border-border" />
      </dl>
    </article>
  );
}

/** The roll number written into register-number boxes, one character per box, in pen blue. */
function RegisterNumber({ value }: { readonly value: string }): React.JSX.Element {
  const characters = Array.from(value || PLACEHOLDER);
  return (
    <p className="mt-3">
      <span className="sr-only">Roll number {value || 'not available'}</span>
      <span aria-hidden="true" className="inline-flex rounded-[3px] border border-border-strong">
        {characters.map((character, index) => (
          <span
            key={index}
            className="flex h-9 w-[clamp(1rem,5.2vw,1.75rem)] items-center justify-center border-l border-border text-[0.9375rem] font-medium text-primary first:border-l-0 sm:text-[1.0625rem]"
          >
            {character}
          </span>
        ))}
      </span>
    </p>
  );
}

function SeatFigure({
  label,
  value,
  className,
}: {
  readonly label: string;
  readonly value: string;
  readonly className?: string;
}): React.JSX.Element {
  const display = value || PLACEHOLDER;
  return (
    <div className={cn('min-w-0 px-5 pb-5 pt-4 sm:px-6', className)}>
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd
        className={cn(
          'mt-3 break-words font-condensed font-extrabold tracking-[-0.01em] tabular-nums',
          figureSize(display),
        )}
      >
        {display}
      </dd>
    </div>
  );
}

function SeatSheetSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true" className="rounded-[5px] border border-border bg-surface">
      <div className="px-5 pb-5 pt-5 sm:px-6">
        <div className="h-5 w-44 animate-pulse rounded bg-surface-hover" />
        <div className="mt-4 inline-flex rounded-[3px] border border-border">
          {Array.from({ length: SKELETON_CELLS }, (_, index) => (
            <span key={index} className="h-9 w-[clamp(1rem,5.2vw,1.75rem)] border-l border-border first:border-l-0" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border">
        <div className="px-5 pb-5 pt-4 sm:px-6">
          <div className="h-3.5 w-12 animate-pulse rounded bg-surface-elevated" />
          <div className="mt-3 h-[4.5rem] w-24 animate-pulse rounded bg-surface-hover sm:h-24" />
        </div>
        <div className="border-l border-border px-5 pb-5 pt-4 sm:px-6">
          <div className="h-3.5 w-10 animate-pulse rounded bg-surface-elevated" />
          <div className="mt-3 h-[4.5rem] w-20 animate-pulse rounded bg-surface-hover sm:h-24" />
        </div>
      </div>
    </div>
  );
}
