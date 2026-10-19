'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { readSearchResponse } from '@/lib/search/response';
import { Search, Loader2, AlertCircle, X, MapPin } from 'lucide-react';

type SearchResult = {
  name: string;
  roll_no: string;
  room_no: string;
  seat_no: string;
};

export function StudentSearch() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleaned = query.trim();
    if (!cleaned) return;

    setLoading(true);
    setMessage(null);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(cleaned)}`);
      const searchResults = await readSearchResponse(response);
      setResults(searchResults);
      if (!searchResults.length) {
        setMessage('No results found for the provided search.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setMessage(null);
    setHasSearched(false);
  }

  const isNoResults = !loading && hasSearched && results.length === 0 && message === 'No results found for the provided search.';
  const isError = !loading && message && message !== 'No results found for the provided search.';

  return (
    <div className="w-full space-y-8">
      {/* Visual Focus: Header / Headline */}
      <section className="space-y-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#262626] bg-[#121212] px-3 py-1 text-xs font-mono tracking-wider text-[#a3a3a3] uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Examination Seating Directory
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white font-sans">
          Find Your Exam Seat
        </h1>
        <p className="text-sm sm:text-base text-[#a3a3a3] max-w-2xl leading-relaxed">
          Search by student name or roll number to look up your allocated examination room, hall, and seat number.
        </p>
      </section>

      {/* Search Console Form */}
      <Card className="border-[#262626] bg-[#111111] p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]" />
            <Input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter student name or roll number (e.g. 24ME001)"
              aria-label="Search student seat"
              className="h-12 pl-10 pr-10 text-sm sm:text-base bg-[#090909] border-[#262626] focus-visible:border-white focus-visible:ring-1 focus-visible:ring-white"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search input"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1 text-[#737373] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            variant="default"
            className="h-12 px-6 sm:w-auto w-full min-w-[120px] font-semibold text-sm shrink-0"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </span>
            ) : (
              'Search'
            )}
          </Button>
        </form>
      </Card>

      {/* Results / Feedback Section */}
      <div className="space-y-4">
        {/* Loading State */}
        {loading && (
          <div className="space-y-3" role="status" aria-busy="true">
            <div className="flex items-center gap-2 text-xs font-mono text-[#a3a3a3] px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
              <span>Querying seating arrangements...</span>
            </div>
            <div className="space-y-3">
              {[1, 2].map((placeholder) => (
                <div
                  key={placeholder}
                  className="rounded-lg border border-[#262626] bg-[#111111] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="h-16 w-24 rounded-md bg-[#191919] animate-pulse" />
                    <div className="space-y-2 flex-1 sm:w-48">
                      <div className="h-5 w-36 rounded bg-[#1c1c1c] animate-pulse" />
                      <div className="h-4 w-24 rounded bg-[#181818] animate-pulse" />
                    </div>
                  </div>
                  <div className="h-9 w-28 rounded-md bg-[#191919] animate-pulse self-end sm:self-auto" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <Alert variant="error" className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#fca5a5] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[#fca5a5]">Search Request Failed</p>
              <p className="text-xs text-[#fecaca] leading-relaxed">{message}</p>
            </div>
          </Alert>
        )}

        {/* No Results State */}
        {isNoResults && (
          <div className="rounded-lg border border-[#262626] bg-[#111111] p-8 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#333333] bg-[#161616] text-[#a3a3a3]">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">No Results Found</h2>
              <p className="mx-auto max-w-md text-xs sm:text-sm text-[#a3a3a3] leading-relaxed">
                No matching seating allocation was found for &ldquo;<span className="text-white font-medium">{query.trim()}</span>&rdquo;. Check the roll number or spelling and try again.
              </p>
            </div>
          </div>
        )}

        {/* Successful Results: High Scanability Cards */}
        {!loading && results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 text-xs text-[#a3a3a3]">
              <span className="font-mono">
                {results.length} {results.length === 1 ? 'record found' : 'records found'}
              </span>
              <span className="text-[11px] text-[#737373] hidden sm:inline">
                Verified from active seating schedule
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {results.map((result, index) => (
                <div
                  key={`${result.roll_no}-${result.seat_no}-${index}`}
                  className="group rounded-lg border border-[#262626] bg-[#111111] p-4 sm:p-5 transition-colors hover:border-[#383838]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Emphasized Room Badge & Student Metadata */}
                    <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
                      {/* Prominent Room Block */}
                      <div className="flex flex-col items-center justify-center rounded-md border border-[#333333] bg-[#191919] px-3.5 py-2.5 min-w-[92px] sm:min-w-[110px] text-center shrink-0">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-[#a3a3a3]">
                          Room
                        </span>
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none mt-1">
                          {result.room_no || '—'}
                        </span>
                      </div>

                      {/* Student Identification */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <h2
                          className="text-base sm:text-lg font-bold text-white tracking-tight truncate group-hover:text-[#f7f7f7]"
                          title={result.name}
                        >
                          {result.name || 'Unnamed Student'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded bg-[#191919] border border-[#262626] px-2 py-0.5 font-mono text-[#d4d4d4]">
                            <span className="text-[#737373]">Roll:</span> {result.roll_no || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Seat Allocation Badge */}
                    <div className="flex items-center justify-between sm:justify-end border-t border-[#1c1c1c] sm:border-0 pt-3 sm:pt-0 shrink-0">
                      <span className="text-xs text-[#737373] sm:hidden">Seat Number</span>
                      <div className="inline-flex items-center gap-2 rounded-md border border-[#383838] bg-[#191919] px-3.5 py-2">
                        <span className="text-xs uppercase tracking-wider text-[#a3a3a3]">Seat</span>
                        <span className="font-mono text-base sm:text-lg font-bold text-white">
                          {result.seat_no || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Initial Empty State Guide */}
        {!loading && !hasSearched && (
          <div className="rounded-lg border border-[#222222] bg-[#111111]/60 p-6 sm:p-8 text-center space-y-2">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-[#262626] bg-[#141414] text-[#737373]">
              <MapPin className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-medium text-white">Awaiting Search Input</h2>
            <p className="mx-auto max-w-sm text-xs text-[#737373] leading-relaxed">
              Type your roll number or name in the box above to look up your allocated hall and desk.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
