import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchStudents } = await import('@/lib/db/database');
    const query = new URL(request.url).searchParams.get('query') || '';
    const results = await searchStudents(query);

    return NextResponse.json({ results });
  } catch (error) {
    const errorCode =
      error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : error instanceof Error
          ? error.name
          : 'UnknownError';
    console.error('[api/search] Search failed:', errorCode);
    return NextResponse.json(
      { error: 'Search is temporarily unavailable. Please try again later.' },
      { status: 500 },
    );
  }
}
