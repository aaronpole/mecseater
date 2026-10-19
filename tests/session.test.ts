import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeSession, encodeSession } from '@/lib/auth/session';

describe('admin session cookie signing', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a valid signed session and rejects tampering', () => {
    vi.stubEnv('SESSION_SECRET', 'test-only-session-signing-secret');
    const cookie = encodeSession('admin');

    expect(decodeSession(cookie)).toBe('admin');
    expect(decodeSession(`${cookie.slice(0, -1)}x`)).toBeNull();
  });

  it('rejects unsigned legacy cookies', () => {
    const legacy = Buffer.from(
      JSON.stringify({ username: 'admin', exp: Math.floor(Date.now() / 1000) + 600 }),
    ).toString('base64url');

    expect(decodeSession(legacy)).toBeNull();
  });

  it('rejects expired signed sessions', () => {
    vi.stubEnv('SESSION_SECRET', 'test-only-session-signing-secret');
    const cookie = encodeSession('admin', -1);

    expect(decodeSession(cookie)).toBeNull();
  });
});
