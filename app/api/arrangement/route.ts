import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { deleteActiveArrangement, getActiveArrangement } from '@/lib/db/database';
import { processPendingPdfCleanup } from '@/lib/storage/pdf-cleanup';

export const runtime = 'nodejs';

function persistenceErrorCode(error: unknown) {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : error instanceof Error
      ? error.name
      : 'UnknownError';
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    return NextResponse.json({ arrangement: await getActiveArrangement() });
  } catch (error) {
    console.error('[api/arrangement] Read failed:', persistenceErrorCode(error));
    return NextResponse.json(
      { error: 'Arrangement data is temporarily unavailable.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    await deleteActiveArrangement();
    const cleanup = await processPendingPdfCleanup();
    return NextResponse.json({ success: true, cleanupPending: cleanup.pending });
  } catch (error) {
    console.error('[api/arrangement] Delete failed:', persistenceErrorCode(error));
    return NextResponse.json(
      { error: 'The active arrangement could not be deleted.' },
      { status: 500 },
    );
  }
}
