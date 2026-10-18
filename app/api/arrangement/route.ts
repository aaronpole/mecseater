import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { deleteActiveArrangement, getActiveArrangement, initializeDatabase } from '@/lib/db/database';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  initializeDatabase();
  return NextResponse.json({ arrangement: getActiveArrangement() });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  initializeDatabase();
  deleteActiveArrangement();
  return NextResponse.json({ success: true });
}
