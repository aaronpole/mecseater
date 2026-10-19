import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfParserServiceError } from '@/lib/pdf/parser';

const {
  assertPdfStorageConfiguredMock,
  createPdfObjectKeyMock,
  deleteActiveArrangementMock,
  isPdfStorageEnabledMock,
  markPdfCleanupQueuedMock,
  parsePdfBytesMock,
  processPendingPdfCleanupMock,
  queuePdfCleanupMock,
  removeQueuedPdfMock,
  replaceArrangementMock,
  requireAdminMock,
  safeStorageErrorCodeMock,
  uploadPrivatePdfMock,
  validateExamDateMock,
} = vi.hoisted(() => ({
  assertPdfStorageConfiguredMock: vi.fn(),
  createPdfObjectKeyMock: vi.fn(),
  deleteActiveArrangementMock: vi.fn(),
  isPdfStorageEnabledMock: vi.fn(),
  markPdfCleanupQueuedMock: vi.fn(),
  parsePdfBytesMock: vi.fn(),
  processPendingPdfCleanupMock: vi.fn(),
  queuePdfCleanupMock: vi.fn(),
  removeQueuedPdfMock: vi.fn(),
  replaceArrangementMock: vi.fn(),
  requireAdminMock: vi.fn(),
  safeStorageErrorCodeMock: vi.fn(),
  uploadPrivatePdfMock: vi.fn(),
  validateExamDateMock: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({ requireAdmin: requireAdminMock }));
vi.mock('@/lib/db/database', () => ({
  deleteActiveArrangement: deleteActiveArrangementMock,
  markPdfCleanupQueued: markPdfCleanupQueuedMock,
  queuePdfCleanup: queuePdfCleanupMock,
  replaceArrangement: replaceArrangementMock,
}));
vi.mock('@/lib/pdf/parser', () => ({
  parsePdfBytes: parsePdfBytesMock,
  PdfParserServiceError: class PdfParserServiceError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
      this.name = 'PdfParserServiceError';
    }
  },
  validateExamDate: validateExamDateMock,
}));
vi.mock('@/lib/storage/pdf-cleanup', () => ({
  processPendingPdfCleanup: processPendingPdfCleanupMock,
  removeQueuedPdf: removeQueuedPdfMock,
}));
vi.mock('@/lib/storage/pdf-storage', () => ({
  assertPdfStorageConfigured: assertPdfStorageConfiguredMock,
  createPdfObjectKey: createPdfObjectKeyMock,
  isPdfStorageEnabled: isPdfStorageEnabledMock,
  safeStorageErrorCode: safeStorageErrorCodeMock,
  uploadPrivatePdf: uploadPrivatePdfMock,
}));

import { DELETE } from '@/app/api/arrangement/route';
import { POST } from '@/app/api/upload/route';

const parsed = {
  examDate: '19/10/2030',
  slot: 'Slot 2',
  records: [{ name: 'Synthetic Student', rollNo: 'TEST001', roomNo: '107', seatNo: 'A01' }],
};

function uploadRequest() {
  const form = new FormData();
  form.append('file', new File(['%PDF synthetic'], 'synthetic.pdf', { type: 'application/pdf' }));
  return new NextRequest('https://mecseater.test/api/upload', { method: 'POST', body: form });
}

describe('private PDF upload and arrangement deletion routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminMock.mockResolvedValue('admin');
    isPdfStorageEnabledMock.mockReturnValue(true);
    createPdfObjectKeyMock.mockReturnValue('arrangements/00000000-0000-4000-8000-000000000001.pdf');
    assertPdfStorageConfiguredMock.mockResolvedValue(undefined);
    queuePdfCleanupMock.mockResolvedValue(undefined);
    markPdfCleanupQueuedMock.mockResolvedValue(undefined);
    uploadPrivatePdfMock.mockResolvedValue(undefined);
    parsePdfBytesMock.mockResolvedValue(parsed);
    validateExamDateMock.mockReturnValue({ valid: true });
    replaceArrangementMock.mockResolvedValue({
      id: 1,
      exam_date: parsed.examDate,
      slot: parsed.slot,
      pdf_name: 'synthetic.pdf',
      student_count: 1,
    });
    processPendingPdfCleanupMock.mockResolvedValue({ pending: false });
    removeQueuedPdfMock.mockResolvedValue(true);
    deleteActiveArrangementMock.mockResolvedValue(undefined);
    safeStorageErrorCodeMock.mockReturnValue('StorageError');
  });

  it('refuses uploads while private storage is disabled', async () => {
    isPdfStorageEnabledMock.mockReturnValue(false);

    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Private PDF storage is not configured.',
    });
    expect(uploadPrivatePdfMock).not.toHaveBeenCalled();
    expect(replaceArrangementMock).not.toHaveBeenCalled();
  });

  it('rejects unauthorized upload requests before touching storage', async () => {
    requireAdminMock.mockResolvedValueOnce(
      NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 }),
    );

    const response = await POST(uploadRequest());

    expect(response.status).toBe(401);
    expect(queuePdfCleanupMock).not.toHaveBeenCalled();
    expect(uploadPrivatePdfMock).not.toHaveBeenCalled();
  });

  it('cleans a staged object after a storage upload failure without replacing the active dataset', async () => {
    uploadPrivatePdfMock.mockRejectedValue(new Error('private storage details'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(uploadRequest());

    expect(response.status).toBe(500);
    expect(replaceArrangementMock).not.toHaveBeenCalled();
    expect(removeQueuedPdfMock).toHaveBeenCalledWith(
      'arrangements/00000000-0000-4000-8000-000000000001.pdf',
    );
    expect(await response.text()).not.toContain('private storage details');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('private storage details');
    consoleError.mockRestore();
  });

  it('cleans the staged object after parser failure and preserves the current arrangement', async () => {
    parsePdfBytesMock.mockRejectedValue(new PdfParserServiceError('PDF could not be parsed.', 400));

    const response = await POST(uploadRequest());

    expect(response.status).toBe(400);
    expect(replaceArrangementMock).not.toHaveBeenCalled();
    expect(removeQueuedPdfMock).toHaveBeenCalledTimes(1);
  });

  it('queues staged-object cleanup after a failed replacement transaction', async () => {
    replaceArrangementMock.mockRejectedValue(new Error('transaction failed'));

    const response = await POST(uploadRequest());

    expect(response.status).toBe(500);
    expect(markPdfCleanupQueuedMock).toHaveBeenCalledWith(
      'arrangements/00000000-0000-4000-8000-000000000001.pdf',
    );
    expect(processPendingPdfCleanupMock).toHaveBeenCalled();
  });

  it('replaces only after upload, parsing, and validation, without returning a storage key', async () => {
    const response = await POST(uploadRequest());

    expect(response.status).toBe(200);
    expect(uploadPrivatePdfMock.mock.invocationCallOrder[0]).toBeLessThan(
      parsePdfBytesMock.mock.invocationCallOrder[0],
    );
    expect(parsePdfBytesMock.mock.invocationCallOrder[0]).toBeLessThan(
      replaceArrangementMock.mock.invocationCallOrder[0],
    );
    expect(validateExamDateMock.mock.invocationCallOrder[0]).toBeLessThan(
      replaceArrangementMock.mock.invocationCallOrder[0],
    );
    const responseText = await response.text();
    expect(responseText).not.toContain('arrangements/');
    expect(responseText).not.toContain('TEST001');
  });

  it('commits arrangement deletion before processing queued PDF cleanup', async () => {
    deleteActiveArrangementMock.mockImplementation(async () => {});

    const response = await DELETE(new NextRequest('https://mecseater.test/api/arrangement', {
      method: 'DELETE',
    }));

    expect(response.status).toBe(200);
    expect(deleteActiveArrangementMock.mock.invocationCallOrder[0]).toBeLessThan(
      processPendingPdfCleanupMock.mock.invocationCallOrder[0],
    );
    await expect(response.json()).resolves.toEqual({ success: true, cleanupPending: false });
  });
});
