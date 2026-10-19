import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import {
  markPdfCleanupQueued,
  queuePdfCleanup,
  replaceArrangement,
} from '@/lib/db/database';
import { parsePdfBytes, PdfParserServiceError, validateExamDate } from '@/lib/pdf/parser';
import { processPendingPdfCleanup, removeQueuedPdf } from '@/lib/storage/pdf-cleanup';
import {
  assertPdfStorageConfigured,
  createPdfObjectKey,
  isPdfStorageEnabled,
  safeStorageErrorCode,
  uploadPrivatePdf,
} from '@/lib/storage/pdf-storage';

export const runtime = 'nodejs';
const maxPdfBytes = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  if (!isPdfStorageEnabled()) {
    return NextResponse.json(
      { error: 'Private PDF storage is not configured.' },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are allowed.' }, { status: 400 });
  }
  if (file.size > maxPdfBytes) {
    return NextResponse.json({ error: 'PDF exceeds the 20 MB upload limit.' }, { status: 413 });
  }

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const objectKey = createPdfObjectKey();
  let cleanupPending = false;
  let stagedObjectRegistered = false;
  let replacementAttempted = false;

  try {
    assertPdfStorageConfigured();
    await queuePdfCleanup(objectKey);
    stagedObjectRegistered = true;
    await uploadPrivatePdf(objectKey, fileBytes);

    const parsed = await parsePdfBytes(fileBytes);
    const dateCheck = validateExamDate(parsed.examDate);
    if (!dateCheck.valid) {
      throw new Error(dateCheck.reason);
    }

    const slot = parsed.slot || String(formData.get('slot') || '').trim() || 'Unspecified';
    replacementAttempted = true;
    const arrangement = await replaceArrangement({
      examDate: parsed.examDate,
      slot,
      pdfName: file.name,
      pdfPath: objectKey,
      records: parsed.records,
    });
    stagedObjectRegistered = false;

    const cleanup = await processPendingPdfCleanup();
    return NextResponse.json({
      success: true,
      arrangement,
      examDate: parsed.examDate,
      slot,
      records: parsed.records.length,
      cleanupPending: cleanup.pending,
    });
  } catch (error) {
    if (stagedObjectRegistered) {
      if (!replacementAttempted) {
        cleanupPending = !(await removeQueuedPdf(objectKey));
      } else {
        try {
          await markPdfCleanupQueued(objectKey);
          cleanupPending = (await processPendingPdfCleanup()).pending;
        } catch (cleanupError) {
          console.error('[api/upload] Staged PDF cleanup failed:', safeStorageErrorCode(cleanupError));
          cleanupPending = true;
        }
      }
    }

    if (error instanceof PdfParserServiceError) {
      return NextResponse.json(
        { error: error.message, cleanupPending },
        { status: error.status },
      );
    }

    if (error instanceof Error && error.name === 'PdfStorageConfigurationError') {
      console.error('[api/upload] Private PDF storage is unavailable.');
      return NextResponse.json(
        {
          error: 'Private PDF storage is not configured. Contact the administrator before uploading.',
          cleanupPending,
        },
        { status: 503 },
      );
    }

    if (
      error instanceof Error &&
      (error.message === 'Exam date is missing or invalid in the PDF.' ||
        error.message === 'This seating arrangement is dated in the past.')
    ) {
      return NextResponse.json(
        { error: error.message, cleanupPending },
        { status: 400 },
      );
    }

    const errorCode = safeStorageErrorCode(error);
    console.error('[api/upload] Upload failed:', errorCode);
    return NextResponse.json(
      { error: 'The arrangement could not be saved.', cleanupPending },
      { status: 500 },
    );
  }
}
