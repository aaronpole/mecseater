import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { setSessionCookie } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({ username: '', password: '' }))) as { username?: string; password?: string };
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
    const expectedHash = process.env.ADMIN_PASSWORD_HASH;

    if (!expectedHash) {
      return NextResponse.json({ error: 'ADMIN_PASSWORD_HASH is not configured.' }, { status: 500 });
    }

    const isValidUsername = username === expectedUsername;
    const isValidPassword = bcrypt.compareSync(password, expectedHash);

    if (!isValidUsername || !isValidPassword) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    return setSessionCookie(response, username, 60);
  } catch {
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
}
