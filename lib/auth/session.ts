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

  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeSession(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (!parsed.username || !parsed.exp || parsed.exp < Date.now() / 1000) {
      return null;
    }

    return parsed.username;
  } catch {
    return null;
  }
}

export function getSessionUsername() {
  const cookieStore = cookies();
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
