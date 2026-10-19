'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Upload,
  Trash2,
  LogOut,
  FileText,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Lock,
} from 'lucide-react';

type Arrangement = {
  id: number;
  exam_date: string;
  slot: string | null;
  pdf_name: string;
  student_count: number;
};

export function UploadManager({
  initialArrangement,
  initialLoggedIn,
}: {
  initialArrangement: Arrangement | null;
  initialLoggedIn: boolean;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn);
  const [arrangement, setArrangement] = useState<Arrangement | null>(initialArrangement);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Are you sure you want to delete the active seating arrangement? All associated student seating records will be permanently removed.')
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

  // --- Login View ---
  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-md w-full space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#262626] bg-[#141414] text-white">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Admin Authentication
          </h1>
          <p className="text-xs sm:text-sm text-[#a3a3a3]">
            Sign in with administrative credentials to manage seating schedules.
          </p>
        </div>

        <Card className="border-[#262626] bg-[#111111] p-6 sm:p-7">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-username" className="text-xs font-mono uppercase tracking-wider text-[#a3a3a3]">
                Username
              </label>
              <Input
                id="admin-username"
                type="text"
                value={loginForm.username}
                onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
                required
                className="bg-[#090909] border-[#262626]"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="text-xs font-mono uppercase tracking-wider text-[#a3a3a3]">
                Password
              </label>
              <Input
                id="admin-password"
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                required
                className="bg-[#090909] border-[#262626]"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              variant="default"
              className="w-full h-11 font-semibold text-sm"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {error && (
            <Alert variant="error" className="mt-4 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-[#fca5a5] shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-[#fca5a5]">{error}</p>
            </Alert>
          )}

          {status && (
            <Alert variant="success" className="mt-4 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-[#bbf7d0] shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-[#dcfce7]">{status}</p>
            </Alert>
          )}
        </Card>
      </div>
    );
  }

  // --- Authenticated Dashboard ---
  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#262626] pb-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#262626] bg-[#121212] px-2.5 py-0.5 text-[11px] font-mono tracking-wider text-[#a3a3a3] uppercase">
            <Shield className="h-3 w-3 text-white" />
            Admin Dashboard
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Seating Arrangement
          </h1>
          <p className="text-xs sm:text-sm text-[#a3a3a3]">
            Upload, inspect, and manage active examination room allocations.
          </p>
        </div>

        <div>
          <Button
            type="button"
            onClick={handleLogout}
            disabled={submitting}
            variant="outline"
            className="h-9 px-3 text-xs border-[#262626] text-[#a3a3a3] hover:text-white hover:bg-[#161616]"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Active Arrangement Status */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-[#a3a3a3]">
          <span>Current Active Schedule</span>
          {arrangement ? (
            <span className="inline-flex items-center gap-1.5 text-white font-sans font-medium text-[11px] bg-[#161616] border border-[#2e2e2e] px-2 py-0.5 rounded">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Published
            </span>
          ) : (
            <span className="text-[#737373]">No Data Active</span>
          )}
        </div>

        {arrangement ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Exam Date */}
            <div className="rounded-lg border border-[#262626] bg-[#111111] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono text-[#737373] uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" />
                <span>Exam Date</span>
              </div>
              <p className="text-lg font-bold text-white tracking-tight">
                {arrangement.exam_date || '—'}
              </p>
            </div>

            {/* Slot */}
            <div className="rounded-lg border border-[#262626] bg-[#111111] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono text-[#737373] uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5" />
                <span>Slot</span>
              </div>
              <p className="text-lg font-bold text-white tracking-tight">
                {arrangement.slot || 'Not Set'}
              </p>
            </div>

            {/* Total Student Records */}
            <div className="rounded-lg border border-[#262626] bg-[#111111] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono text-[#737373] uppercase tracking-wider">
                <Users className="h-3.5 w-3.5" />
                <span>Allocations</span>
              </div>
              <p className="text-lg font-bold text-white tracking-tight">
                {arrangement.student_count.toLocaleString()} students
              </p>
            </div>

            {/* Source PDF */}
            <div className="rounded-lg border border-[#262626] bg-[#111111] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono text-[#737373] uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5" />
                <span>Source File</span>
              </div>
              <p className="text-sm font-medium text-white truncate" title={arrangement.pdf_name}>
                {arrangement.pdf_name || 'Seating PDF'}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-[#262626] bg-[#111111] p-6 text-center space-y-2">
            <FileText className="mx-auto h-8 w-8 text-[#737373]" />
            <h3 className="text-sm font-semibold text-white">No Active Arrangement</h3>
            <p className="mx-auto max-w-sm text-xs text-[#a3a3a3] leading-relaxed">
              No seating arrangement is currently published. Upload an official seating arrangement PDF to populate exam rooms and seats.
            </p>
          </div>
        )}
      </section>

      {/* Upload & Replacement Controls */}
      <Card className="border-[#262626] bg-[#111111] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-white">
            Upload & Replace Seating Data
          </h2>
          <p className="text-xs text-[#a3a3a3] mt-0.5">
            Uploading a new PDF replaces the current active arrangement and updates all student seating records.
          </p>
        </div>

        <form onSubmit={handleUpload} className="space-y-5">
          {/* Custom Styled File Input Area */}
          <div>
            <input
              ref={fileInputRef}
              id="pdf-upload-input"
              type="file"
              accept="application/pdf"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)}
              className="sr-only"
            />
            <label
              htmlFor="pdf-upload-input"
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#333333] hover:border-[#525252] bg-[#090909] p-6 text-center transition-colors cursor-pointer group focus-within:ring-2 focus-within:ring-white"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#262626] bg-[#141414] text-[#a3a3a3] group-hover:text-white">
                <Upload className="h-5 w-5" />
              </div>
              {file ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white break-all">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#a3a3a3] font-mono">
                    {(file.size / 1024).toFixed(1)} KB — Click to change file
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white group-hover:underline">
                    Click to select seating PDF
                  </p>
                  <p className="text-xs text-[#737373]">
                    Only official PDF documents are accepted
                  </p>
                </div>
              )}
            </label>
          </div>

          {/* Action Buttons: Primary (Upload/Replace) vs Clearly Destructive (Delete) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#1c1c1c]">
            {/* Primary Action */}
            <Button
              type="submit"
              disabled={submitting || !file}
              variant="default"
              className="h-11 px-5 font-semibold text-sm shrink-0"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing PDF...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {arrangement ? 'Replace Active Seating Data' : 'Upload & Publish Seating Data'}
                </span>
              )}
            </Button>

            {/* Clearly Destructive Action */}
            <Button
              type="button"
              onClick={handleDelete}
              disabled={submitting || !arrangement}
              variant="destructive"
              className="h-11 px-4 text-xs sm:text-sm shrink-0"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Current Seating Data
            </Button>
          </div>
        </form>

        {/* Feedback Messages */}
        {error && (
          <Alert variant="error" className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-[#fca5a5] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-xs text-[#fca5a5]">Action Failed</p>
              <p className="text-xs text-[#fecaca] leading-relaxed">{error}</p>
            </div>
          </Alert>
        )}

        {status && (
          <Alert variant="success" className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-[#bbf7d0] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-xs text-[#dcfce7]">Success</p>
              <p className="text-xs text-[#dcfce7] leading-relaxed">{status}</p>
            </div>
          </Alert>
        )}
      </Card>
    </div>
  );
}
