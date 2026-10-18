import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { requireAdmin } from '@/lib/auth/session';
import { getActiveArrangement, initializeDatabase, replaceArrangement } from '@/lib/db/database';
import { parsePdfFile, validateExamDate } from '@/lib/pdf/parser';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are allowed.' }, { status: 400 });
  }

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const pdfDir = path.join(process.cwd(), 'data', 'uploads');
  await mkdir(pdfDir, { recursive: true });

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const tempPath = path.join(pdfDir, safeName);

  try {
    await writeFile(tempPath, fileBytes);
    const parsed = await parsePdfFile(tempPath);
    const dateCheck = validateExamDate(parsed.examDate);
    if (!dateCheck.valid) {
      throw new Error(dateCheck.reason);
    }

    const slot = parsed.slot || String(formData.get('slot') || '').trim() || 'Unspecified';
    initializeDatabase();
    replaceArrangement({
      examDate: parsed.examDate,
      slot,
      pdfName: file.name,
      pdfPath: tempPath,
      records: parsed.records,
    });

    const arrangement = getActiveArrangement();
    return NextResponse.json({ success: true, arrangement, examDate: parsed.examDate, slot, records: parsed.records.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed.' }, { status: 400 });
  }
}
