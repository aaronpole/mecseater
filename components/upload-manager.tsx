'use client';

import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Upload } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Arrangement = {
  id: number;
  exam_date: string;
  slot: string | null;
  pdf_name: string;
  student_count: number;
};

const BYTES_PER_KB = 1024;
const PDF_MIME_TYPE = 'application/pdf';

function formatFileSize(bytes: number): string {
  const kilobytes = bytes / BYTES_PER_KB;
  return kilobytes >= BYTES_PER_KB ? `${(kilobytes / BYTES_PER_KB).toFixed(1)} MB` : `${kilobytes.toFixed(0)} KB`;
}

export function UploadManager({
  initialArrangement,
  initialLoggedIn,
}: {
  readonly initialArrangement: Arrangement | null;
  readonly initialLoggedIn: boolean;
}): React.JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn);
  const [arrangement, setArrangement] = useState<Arrangement | null>(initialArrangement);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const loadArrangement = async (): Promise<void> => {
      const response = await fetch('/api/arrangement');
      const data = await response.json();
      if (response.ok) {
        setArrangement(data.arrangement);
      }
    };

    void loadArrangement();
  }, [isLoggedIn]);

  async function handleLogin(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Login failed');
      }
      setIsLoggedIn(true);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!file) {
      setError('Select a PDF file to upload.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Upload failed');
      }
      setArrangement(payload.arrangement);
      setStatus(
        payload.cleanupPending
          ? 'Published. Removing the previous PDF from storage failed and will be retried.'
          : `Published ${payload.arrangement?.pdf_name || 'the new seating arrangement'}. Students can search it now.`,
      );
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(): Promise<void> {
    const confirmed =
      typeof window !== 'undefined'
        ? window.confirm('Delete the live seating arrangement? Students will get no results until a new PDF is uploaded.')
        : true;

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch('/api/arrangement', { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Delete failed');
      }
      setArrangement(null);
      setStatus(
        payload.cleanupPending
          ? 'Arrangement deleted. Removing its PDF from storage failed and will be retried.'
          : 'Arrangement deleted.',
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout(): Promise<void> {
    setSubmitting(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
      setIsLoggedIn(false);
      setArrangement(null);
      setStatus(null);
      setError(null);
    } catch {
      setError('Unable to sign out.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (!dropped) return;
    if (dropped.type !== PDF_MIME_TYPE) {
      setError('Only PDF files can be uploaded.');
      return;
    }
    setError(null);
    setFile(dropped);
  }

  const uploadLabel = arrangement ? 'Replace live arrangement' : 'Publish arrangement';

  if (!isLoggedIn) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-2 text-sm text-text-secondary">
          For exam cell staff publishing seating PDFs. Students don&rsquo;t need an account.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="admin-username" className="block text-sm font-medium">
              Username
            </label>
            <Input
              id="admin-username"
              type="text"
              value={loginForm.username}
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
              required
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="admin-password" className="block text-sm font-medium">
              Password
            </label>
            <Input
              id="admin-password"
              type="password"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Seating arrangement</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Students only see the arrangement that&rsquo;s live. Uploading a PDF replaces it.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} disabled={submitting} className="shrink-0">
          Sign out
        </Button>
      </div>

      <section aria-labelledby="live-heading" className="mt-10">
        <h2 id="live-heading" className="text-sm font-medium text-text-secondary">
          Live now
        </h2>

        {arrangement ? (
          <div className="mt-3 rounded-xl border border-border bg-surface">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl bg-border sm:grid-cols-4">
              <Fact label="Exam date" value={arrangement.exam_date || '—'} />
              <Fact label="Slot" value={arrangement.slot || '—'} />
              <Fact label="Students" value={arrangement.student_count.toLocaleString()} />
              <Fact label="Source PDF" value={arrangement.pdf_name || '—'} truncate />
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <p className="text-sm text-text-secondary">Remove this arrangement without replacing it.</p>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={submitting}>
                Delete arrangement
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-border-strong px-5 py-6 text-sm text-text-secondary">
            Nothing is published. Students will get no results until you upload a seating PDF.
          </p>
        )}
      </section>

      <section aria-labelledby="upload-heading" className="mt-10">
        <h2 id="upload-heading" className="text-sm font-medium text-text-secondary">
          {arrangement ? 'Replace with a new PDF' : 'Publish a seating PDF'}
        </h2>

        <form onSubmit={handleUpload} className="mt-3 space-y-4">
          <input
            ref={fileInputRef}
            id="pdf-upload-input"
            type="file"
            accept={PDF_MIME_TYPE}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setError(null);
              setFile(event.target.files?.[0] || null);
            }}
            className="peer sr-only"
          />
          <label
            htmlFor="pdf-upload-input"
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex cursor-pointer items-center gap-4 rounded-xl border border-dashed px-5 py-6 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
              isDragging ? 'border-primary bg-surface' : 'border-border-strong hover:border-text-secondary',
            )}
          >
            {file ? (
              <FileText className="h-6 w-6 shrink-0 text-text" aria-hidden="true" />
            ) : (
              <Upload className="h-6 w-6 shrink-0 text-muted" aria-hidden="true" />
            )}
            <span className="min-w-0">
              {file ? (
                <>
                  <span className="block break-all font-medium">{file.name}</span>
                  <span className="mt-0.5 block text-sm text-text-secondary">
                    {formatFileSize(file.size)} · click to choose a different file
                  </span>
                </>
              ) : (
                <>
                  <span className="block font-medium">Drop the seating PDF here, or click to browse</span>
                  <span className="mt-0.5 block text-sm text-text-secondary">
                    The exam cell&rsquo;s seating arrangement PDF. Exam date and slot are read from it.
                  </span>
                </>
              )}
            </span>
          </label>

          <Button type="submit" disabled={submitting || !file}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Reading PDF…' : uploadLabel}
          </Button>
        </form>
      </section>

      <div aria-live="polite" className="mt-6 space-y-3">
        {error && <Alert variant="error">{error}</Alert>}
        {status && (
          <Alert variant="success" role="status" className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{status}</span>
          </Alert>
        )}
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  truncate = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly truncate?: boolean;
}): React.JSX.Element {
  return (
    <div className="min-w-0 bg-surface px-5 py-4">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className={cn('mt-1 font-medium tabular-nums', truncate && 'truncate')} title={truncate ? value : undefined}>
        {value}
      </dd>
    </div>
  );
}
