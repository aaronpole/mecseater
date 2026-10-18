'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleaned = query.trim();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(cleaned)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to search');
      }
      setResults(payload.results || []);
      if (!payload.results?.length) {
        setMessage('No results found for the provided search.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-3xl border-primary/20 bg-surface/90">
      <div className="mb-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">mecseater</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Enter your name or roll number"
          aria-label="Search student seat"
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !query.trim()} className="min-w-[100px] bg-primary text-background hover:bg-primary-hover hover:text-background">
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      <div className="mt-6">
        {message && <Alert className="mb-4 border-border bg-background/80">{message}</Alert>}

        {!loading && results.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-background text-text">
                <tr>
                  <th className="border-b border-border px-3 py-3 font-semibold">Name</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Roll No</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Room No</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Seat No</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={`${result.roll_no}-${result.seat_no}`} className="odd:bg-surface even:bg-background/60">
                    <td className="border-b border-border px-3 py-3 text-text">{result.name}</td>
                    <td className="border-b border-border px-3 py-3 text-text">{result.roll_no}</td>
                    <td className="border-b border-border px-3 py-3 text-text">{result.room_no}</td>
                    <td className="border-b border-border px-3 py-3 text-text">{result.seat_no}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
