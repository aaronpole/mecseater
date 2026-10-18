import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, searchStudents } from '@/lib/db/database';

export async function GET(request: NextRequest) {
  initializeDatabase();
  const query = new URL(request.url).searchParams.get('query') || '';
  const results = searchStudents(query);

  return NextResponse.json({ results });
}
