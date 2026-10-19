'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Arrangement = {
  id: number;
  exam_date: string;
  slot: string | null;
  pdf_name: string;
  student_count: number;
};

export function UploadManager({ initialArrangement, initialLoggedIn }: { initialArrangement: Arrangement | null; initialLoggedIn: boolean }) {
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn);
  const [arrangement, setArrangement] = useState<Arrangement | null>(initialArrangement);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const loadArrangement = async () => {
      const response = await fetch('/api/arrangement');
      const data = await response.json();
      if (response.ok) {
        setArrangement(data.arrangement);
      }
    };

    void loadArrangement();
  }, [isLoggedIn]);

  async function handleLogin(event: FormEvent) {
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
      setStatus('Logged in successfully.');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(event: FormEvent) {
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
          ? 'Upload succeeded. Cleanup of the previous PDF is pending and will be retried.'
          : `Upload succeeded: ${payload.arrangement?.pdf_name || 'new seating arrangement'} imported.`,
      );
      setFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
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
          ? 'Seating arrangement deleted. PDF cleanup is pending and will be retried.'
          : 'Current seating arrangement deleted.',
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setSubmitting(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
      setIsLoggedIn(false);
      setArrangement(null);
      setStatus('Logged out successfully.');
    } catch {
      setError('Unable to log out.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent>
          <h2 className="text-2xl font-semibold text-text">Admin login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted">Username</label>
              <Input value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Password</label>
              <Input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-primary text-background hover:bg-primary-hover hover:text-background">
              {submitting ? 'Signing in...' : 'Login'}
            </Button>
          </form>
          {error && <Alert className="mt-4 border-red-500/30 bg-red-500/5 text-red-200">{error}</Alert>}
          {status && <Alert className="mt-4 border-primary/30 bg-primary/5 text-primary">{status}</Alert>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-text">Upload seating arrangement</h2>
          <Button type="button" onClick={handleLogout} className="border-primary text-primary hover:border-primary hover:bg-primary/10">
            Logout
          </Button>
        </div>

        {arrangement ? (
          <div className="grid gap-3 rounded-lg border border-border bg-background/60 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Exam date</p>
              <p className="mt-1 text-lg font-medium text-text">{arrangement.exam_date}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Slot</p>
              <p className="mt-1 text-lg font-medium text-text">{arrangement.slot || 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Records</p>
              <p className="mt-1 text-lg font-medium text-text">{arrangement.student_count}</p>
            </div>
          </div>
        ) : (
          <Alert className="mt-4 border-border bg-background/60">No active seating arrangement is currently uploaded.</Alert>
        )}

        <form onSubmit={handleUpload} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted">PDF upload</label>
            <Input type="file" accept="application/pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting || !file} className="bg-primary text-background hover:bg-primary-hover hover:text-background">
              {submitting ? 'Uploading...' : 'Replace current seating data'}
            </Button>
            <Button type="button" onClick={handleDelete} disabled={submitting || !arrangement} className="border-red-500 text-red-200 hover:bg-red-500/10">
              Delete current seating data
            </Button>
          </div>
        </form>

        {error && <Alert className="mt-4 border-red-500/30 bg-red-500/5 text-red-200">{error}</Alert>}
        {status && <Alert className="mt-4 border-primary/30 bg-primary/5 text-primary">{status}</Alert>}
      </CardContent>
    </Card>
  );
}
