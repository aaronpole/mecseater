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
const BLANK_REGISTER_BOXES = 12;

/** The form fills in top to bottom, like writing on the booklet cover. */
const WRITE_STEP_MS = 160;
const WRITE_ORDER = ['name', 'register', 'room', 'seat'] as const;
const WRITE_DELAY_MS = Object.fromEntries(WRITE_ORDER.map((field, step) => [field, step * WRITE_STEP_MS])) as Readonly<
  Record<(typeof WRITE_ORDER)[number], number>
>;

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
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    setPickedIndex(null);
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
    setPickedIndex(null);
    setState({ kind: 'idle' });
    inputRef.current?.focus();
  }

  const isLoading = state.kind === 'loading';
  const results = state.kind === 'done' ? state.results : [];
  const onlyResult = results.length === 1 ? results[0] : null;
  const pickedResult = pickedIndex === null ? null : results[pickedIndex] ?? null;
  const shownResult = onlyResult ?? pickedResult;

  return (
    <article className="answer-sheet overflow-hidden rounded-[5px] border border-border">
      <div className="pb-10 pl-[calc(var(--sheet-margin)+1rem)] pr-4 pt-8 sm:pb-14 sm:pl-[calc(var(--sheet-margin)+2rem)] sm:pr-12 sm:pt-12">
        <h1 className="text-balance font-semicondensed text-[2.75rem]/[0.95] font-bold tracking-[-0.025em] sm:text-[4rem]/[0.95]">
          Find your exam seat
        </h1>
        <p className="mt-4 max-w-[42ch] text-[1.0625rem] leading-relaxed text-text-secondary">
          Enter your roll number or name. Your room and seat fill in below.
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
                className="h-14 w-full rounded-md border-[1.5px] border-border-strong bg-surface pl-3.5 pr-11 text-base text-text sm:pl-4 sm:pr-12 sm:text-lg outline-none transition-[border-color,box-shadow] placeholder:text-muted hover:border-text-secondary focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_18%,transparent)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
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
            <Button type="submit" disabled={isLoading || !query.trim()} className="h-14 shrink-0 rounded-md px-4 text-base sm:px-5">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Finding seat" /> : 'Find seat'}
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted">A full roll number gives one exact match. Part of a name works too.</p>
        </form>

        <div aria-live="polite" aria-busy={isLoading}>
          <SearchMessage state={state} />
          {results.length > 1 && (
            <MatchPicker results={results} pickedIndex={pickedIndex} onPick={setPickedIndex} term={query.trim()} />
          )}
          <SeatForm key={shownResult ? `${shownResult.roll_no}-${shownResult.seat_no}` : 'blank'} result={shownResult} />
        </div>
      </div>
    </article>
  );
}

type MessageRenderers = {
  readonly [Kind in SearchState['kind']]: (state: Extract<SearchState, { kind: Kind }>) => React.JSX.Element | null;
};

const messageRenderers: MessageRenderers = {
  idle: () => null,
  loading: () => null,
  error: (state) => (
    <Alert variant="error" className="mt-8">
      <p className="font-medium">Search didn&rsquo;t go through</p>
      <p className="mt-0.5 opacity-85">{state.message}</p>
    </Alert>
  ),
  done: (state) =>
    state.results.length === 0 ? (
      <div className="mt-8 border-l-2 border-danger pl-4">
        <p className="font-medium">No seat found for &ldquo;{state.term}&rdquo;</p>
        <p className="mt-1 text-sm text-text-secondary">
          Check the spelling, or search with your full roll number instead.
        </p>
      </div>
    ) : null,
};

function SearchMessage({ state }: { readonly state: SearchState }): React.JSX.Element | null {
  const render = messageRenderers[state.kind] as (current: SearchState) => React.JSX.Element | null;
  return render(state);
}

function MatchPicker({
  results,
  pickedIndex,
  onPick,
  term,
}: {
  readonly results: readonly SearchResult[];
  readonly pickedIndex: number | null;
  readonly onPick: (index: number) => void;
  readonly term: string;
}): React.JSX.Element {
  return (
    <section aria-labelledby="matches-heading" className="mt-8">
      <h2 id="matches-heading" className="text-sm text-text-secondary">
        {results.length} students match &ldquo;{term}&rdquo;. Pick yours.
      </h2>
      <ul className="mt-2 border-t border-border">
        {results.map((result, index) => {
          const isPicked = index === pickedIndex;
          return (
            <li key={`${result.roll_no}-${result.seat_no}-${index}`} className="border-b border-border">
              <button
                type="button"
                aria-pressed={isPicked}
                onClick={() => onPick(index)}
                className={cn(
                  'flex min-h-12 w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3 text-left transition-colors',
                  isPicked ? 'text-primary' : 'text-text hover:text-primary',
                )}
              >
                <span className="font-medium">{result.name ? toTitleCase(result.name) : 'Unnamed student'}</span>
                <span className="text-sm tabular-nums text-text-secondary">{result.roll_no}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The booklet cover: printed labels in ink, the student's details written in pen blue.
 * Blank until there is exactly one result to show.
 */
function SeatForm({ result }: { readonly result: SearchResult | null }): React.JSX.Element {
  return (
    <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-7 sm:mt-12">
      <div className="col-span-2">
        <dt className="text-sm text-text-secondary">Name</dt>
        <dd className="mt-1.5 min-h-8">
          {result ? (
            <WrittenIn delayMs={WRITE_DELAY_MS.name} className="text-[1.375rem]/[2rem] font-medium">
              {result.name ? toTitleCase(result.name) : 'Unnamed student'}
            </WrittenIn>
          ) : (
            <span className="block h-8 max-w-sm border-b-[1.5px] border-dotted border-border-strong" />
          )}
        </dd>
      </div>

      <div className="col-span-2">
        <dt className="text-sm text-text-secondary">Register no.</dt>
        <dd className="mt-2">
          <RegisterBoxes value={result?.roll_no ?? ''} />
        </dd>
      </div>

      <SeatFigure label="Room" value={result?.room_no ?? null} delayMs={WRITE_DELAY_MS.room} />
      <SeatFigure label="Seat" value={result?.seat_no ?? null} delayMs={WRITE_DELAY_MS.seat} />
    </dl>
  );
}

function WrittenIn({
  delayMs,
  className,
  children,
}: {
  readonly delayMs: number;
  readonly className?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className={cn('inline-block animate-write-in text-primary', className)} style={{ animationDelay: `${delayMs}ms` }}>
      {children}
    </span>
  );
}

/** Register-number boxes from the answer-booklet cover, one character per box. */
function RegisterBoxes({ value }: { readonly value: string }): React.JSX.Element {
  const cells = value ? Array.from(value) : Array.from({ length: BLANK_REGISTER_BOXES }, () => '');
  return (
    <>
      {value && <span className="sr-only">{value}</span>}
      <span aria-hidden="true" className="inline-flex rounded-[3px] border border-border-strong bg-surface">
        {cells.map((character, index) => (
          <span
            key={index}
            className="flex h-10 w-[clamp(1rem,4.6vw,1.875rem)] items-center justify-center border-l border-border text-[0.9375rem] font-semibold text-primary first:border-l-0 sm:text-lg"
          >
            {character && (
              <span className="animate-write-in" style={{ animationDelay: `${WRITE_DELAY_MS.register}ms` }}>
                {character}
              </span>
            )}
          </span>
        ))}
      </span>
    </>
  );
}

function SeatFigure({
  label,
  value,
  delayMs,
}: {
  readonly label: string;
  readonly value: string | null;
  readonly delayMs: number;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="mt-3">
        {value === null ? (
          <span
            className={cn(
              'block w-[1.7em] border-b-[3px] border-dotted border-border-strong font-condensed',
              figureSize(''),
            )}
          >
            &nbsp;
          </span>
        ) : (
          <WrittenIn
            delayMs={delayMs}
            className={cn('break-words font-condensed font-extrabold tracking-[-0.01em] tabular-nums', figureSize(value || '—'))}
          >
            {value || '—'}
          </WrittenIn>
        )}
      </dd>
    </div>
  );
}
