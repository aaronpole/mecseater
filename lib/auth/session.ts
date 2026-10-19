import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'mecseater_admin';

type SessionPayload = {
  username: string;
  exp: number;
};

export function encodeSession(username: string, expiresMinutes = 60) {
  const payload: SessionPayload = {
    username,
    exp: Math.floor(Date.now() / 1000) + expiresMinutes * 60,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${signSession(encodedPayload)}`;
}

function signSession(encodedPayload: string) {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD_HASH;
  if (!secret) {
    throw new Error('SESSION_SECRET or ADMIN_PASSWORD_HASH is required to sign admin sessions.');
  }
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function decodeSession(value: string | undefined) {
  if (!value || !value.includes('.')) {
    return null;
  }

  try {
    const [encodedPayload, signature, ...extraParts] = value.split('.');
    if (!encodedPayload || !signature || extraParts.length > 0) {
      return null;
    }
    const expectedSignature = signSession(encodedPayload);
    const supplied = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return null;
    }

    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (
      typeof parsed.username !== 'string' ||
      !parsed.username ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now() / 1000
    ) {
      return null;
    }

    return parsed.username;
  } catch {
    return null;
  }
}

export async function getSessionUsername() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(SESSION_COOKIE)?.value) ?? null;
}

export function getSessionUsernameFromRequest(request: NextRequest | Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return decodeSession(match ? decodeURIComponent(match[1]) : undefined) ?? null;
}

export function setSessionCookie(response: NextResponse, username: string, expiresMinutes = 60) {
  const value = encodeSession(username, expiresMinutes);
  response.cookies.set({
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: expiresMinutes * 60,
    path: '/',
  });

  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

export async function requireAdmin(request: NextRequest) {
  const username = getSessionUsernameFromRequest(request);
  if (!username) {
    return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  }

  return username;
}
