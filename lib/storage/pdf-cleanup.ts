import {
  getPendingPdfCleanupKeys,
  removePdfCleanupKey,
} from '@/lib/db/database';
import {
  deletePrivatePdf,
  safeStorageErrorCode,
} from '@/lib/storage/pdf-storage';

const cleanupBatchSize = 100;

export async function removeQueuedPdf(objectKey: string) {
  try {
    await deletePrivatePdf(objectKey);
    await removePdfCleanupKey(objectKey);
    return true;
  } catch (error) {
    console.error('[pdf-storage] Cleanup failed:', safeStorageErrorCode(error));
    return false;
  }
}

export async function processPendingPdfCleanup() {
  try {
    const keys = await getPendingPdfCleanupKeys(cleanupBatchSize);
    let pending = keys.length === cleanupBatchSize;

    for (const key of keys) {
      if (!(await removeQueuedPdf(key))) {
        pending = true;
      }
    }

    return { pending };
  } catch (error) {
    console.error('[pdf-storage] Cleanup queue unavailable:', safeStorageErrorCode(error));
    return { pending: true };
  }
}
