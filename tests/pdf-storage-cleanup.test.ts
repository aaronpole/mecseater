import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deletePrivatePdfMock,
  getPendingPdfCleanupKeysMock,
  removePdfCleanupKeyMock,
  safeStorageErrorCodeMock,
} = vi.hoisted(() => ({
  deletePrivatePdfMock: vi.fn(),
  getPendingPdfCleanupKeysMock: vi.fn(),
  removePdfCleanupKeyMock: vi.fn(),
  safeStorageErrorCodeMock: vi.fn(),
}));

vi.mock('@/lib/db/database', () => ({
  getPendingPdfCleanupKeys: getPendingPdfCleanupKeysMock,
  removePdfCleanupKey: removePdfCleanupKeyMock,
}));
vi.mock('@/lib/storage/pdf-storage', () => ({
  deletePrivatePdf: deletePrivatePdfMock,
  safeStorageErrorCode: safeStorageErrorCodeMock,
}));

import {
  processPendingPdfCleanup,
  removeQueuedPdf,
} from '@/lib/storage/pdf-cleanup';

describe('private PDF cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deletePrivatePdfMock.mockResolvedValue(undefined);
    removePdfCleanupKeyMock.mockResolvedValue(undefined);
    getPendingPdfCleanupKeysMock.mockResolvedValue([]);
    safeStorageErrorCodeMock.mockReturnValue('StorageError');
  });

  it('keeps failed deletion queued and reports cleanup as pending', async () => {
    deletePrivatePdfMock.mockRejectedValue(new Error('secret storage message'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(removeQueuedPdf('arrangements/test.pdf')).resolves.toBe(false);

    expect(removePdfCleanupKeyMock).not.toHaveBeenCalled();
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('secret storage message');
    consoleError.mockRestore();
  });

  it('removes a queue entry only after private object deletion succeeds', async () => {
    await expect(removeQueuedPdf('arrangements/test.pdf')).resolves.toBe(true);

    expect(deletePrivatePdfMock.mock.invocationCallOrder[0]).toBeLessThan(
      removePdfCleanupKeyMock.mock.invocationCallOrder[0],
    );
  });

  it('keeps the queue entry if removing it from the database fails after object deletion', async () => {
    removePdfCleanupKeyMock.mockRejectedValue(new Error('database detail'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(removeQueuedPdf('arrangements/test.pdf')).resolves.toBe(false);

    expect(deletePrivatePdfMock).toHaveBeenCalledWith('arrangements/test.pdf');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('database detail');
    consoleError.mockRestore();
  });

  it('reports cleanup as pending when the database queue cannot be read', async () => {
    getPendingPdfCleanupKeysMock.mockRejectedValue(new Error('private database details'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(processPendingPdfCleanup()).resolves.toEqual({ pending: true });

    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('private database details');
    consoleError.mockRestore();
  });
});
