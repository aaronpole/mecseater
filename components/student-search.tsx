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
 * Room and seat values range from "7" to "Seminar Hall". Step the size down with length so
 * the figure stays as large as possible without breaking mid-word on a 320px phone.
 */
const SHORT_FIGURE_LENGTH = 4;
const MEDIUM_FIGURE_LENGTH = 7;
const FIGURE_SIZES: ReadonlyArray<{ readonly maxLength: number; readonly className: string }> = [
  { maxLength: SHORT_FIGURE_LENGTH, className: 'text-5xl sm:text-6xl' },
  { maxLength: MEDIUM_FIGURE_LENGTH, className: 'text-4xl sm:text-5xl' },
  { maxLength: Number.POSITIVE_INFINITY, className: 'text-2xl sm:text-3xl' },
];

function figureSize(value: string): string {
  return FIGURE_SIZES.find((size) => value.length <= size.maxLength)?.className ?? '';
}
const PLACEHOLDER = '—';

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
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find your exam seat</h1>
      <p className="mt-2 text-text-secondary">Enter your roll number or name to see your room and seat.</p>

      <form role="search" onSubmit={handleSubmit} className="mt-8">
        <label htmlFor="seat-query" className="sr-only">
          Roll number or name
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id="seat-query"
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. MDL24CS001"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-14 w-full rounded-lg border border-border-strong bg-surface pl-4 pr-12 text-lg text-text outline-none transition-colors placeholder:text-muted hover:border-text-secondary focus-visible:border-primary focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
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
          <Button type="submit" disabled={isLoading || !query.trim()} className="h-14 w-24 shrink-0 rounded-lg text-base sm:w-28">
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Searching" /> : 'Search'}
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted">
          Use your full roll number for an exact match. Part of a name works too.
        </p>
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
  loading: () => <ResultSkeleton />,
  error: (state) => (
    <Alert variant="error">
      <p className="font-medium">Search didn&rsquo;t go through</p>
      <p className="mt-0.5 text-danger/80">{state.message}</p>
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
        <p className="mb-3 text-sm text-text-secondary">
          {results.length} students match. Find your roll number below.
        </p>
      )}
      <ul className="space-y-4">
        {results.map((result, index) => (
          <li key={`${result.roll_no}-${result.seat_no}-${index}`}>
            <SeatCard result={result} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SeatCard({ result }: { readonly result: SearchResult }): React.JSX.Element {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pb-4 pt-5">
        <h2 className="min-w-0 break-words text-lg font-medium leading-snug">{result.name || 'Unnamed student'}</h2>
        <p className="font-mono text-sm text-text-secondary">{result.roll_no || PLACEHOLDER}</p>
      </header>
      <dl className="grid grid-cols-2 border-t border-border">
        <SeatFigure label="Room" value={result.room_no} />
        <SeatFigure label="Seat" value={result.seat_no} className="border-l border-border" />
      </dl>
    </article>
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
    <div className={cn('min-w-0 px-5 py-4 sm:py-5', className)}>
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd
        className={cn('mt-2 break-words font-semibold leading-none tracking-tight tabular-nums', figureSize(display))}
      >
        {display}
      </dd>
    </div>
  );
}

function ResultSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <div className="h-5 w-44 animate-pulse rounded bg-surface-hover" />
        <div className="h-4 w-24 animate-pulse rounded bg-surface-elevated" />
      </div>
      <div className="grid grid-cols-2 border-t border-border">
        <div className="space-y-3 px-5 py-5">
          <div className="h-3.5 w-12 animate-pulse rounded bg-surface-elevated" />
          <div className="h-12 w-20 animate-pulse rounded bg-surface-hover" />
        </div>
        <div className="space-y-3 border-l border-border px-5 py-5">
          <div className="h-3.5 w-10 animate-pulse rounded bg-surface-elevated" />
          <div className="h-12 w-16 animate-pulse rounded bg-surface-hover" />
        </div>
      </div>
    </div>
  );
}
