import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';

const bucket = 'mecseater-pdfs';
const objectKeyPattern = /^arrangements\/[0-9a-f-]{36}\.pdf$/i;

function requiredEnvironmentValue(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function safeErrorCode(error) {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  if (
    error instanceof Error &&
    '$metadata' in error &&
    error.$metadata !== null &&
    typeof error.$metadata === 'object' &&
    'httpStatusCode' in error.$metadata &&
    typeof error.$metadata.httpStatusCode === 'number'
  ) {
    return `HTTP_${error.$metadata.httpStatusCode}`;
  }
  return error instanceof Error ? error.name : 'UnknownError';
}

async function main() {
  if (process.env.PDF_STORAGE_ENABLED !== '1') {
    throw new Error('PDF_STORAGE_ENABLED must be set to 1.');
  }

  const storage = new S3Client({
    region: requiredEnvironmentValue('AWS_REGION'),
    endpoint: requiredEnvironmentValue('AWS_ENDPOINT_URL_S3'),
    credentials: {
      accessKeyId: requiredEnvironmentValue('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnvironmentValue('AWS_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
    maxAttempts: 3,
  });
  const database = new Pool({
    connectionString: requiredEnvironmentValue('DATABASE_URL'),
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  let removed = 0;
  let pending = 0;

  try {
    await database.query(
      `UPDATE pdf_cleanup_queue
       SET status = 'queued', queued_at = now()
       WHERE status = 'staging'
         AND queued_at < now() - INTERVAL '30 minutes'`,
    );
    const { rows } = await database.query(
      `SELECT object_key
       FROM pdf_cleanup_queue
       WHERE status = 'queued'
       ORDER BY queued_at ASC`,
    );

    for (const { object_key: objectKey } of rows) {
      if (!objectKeyPattern.test(objectKey)) {
        console.error('[pdf-storage-cleanup] Skipped invalid queued key.');
        pending += 1;
        continue;
      }

      try {
        await storage.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: objectKey,
          }),
        );
        await database.query(
          'DELETE FROM pdf_cleanup_queue WHERE object_key = $1',
          [objectKey],
        );
        removed += 1;
      } catch (error) {
        console.error('[pdf-storage-cleanup] Delete failed:', safeErrorCode(error));
        pending += 1;
      }
    }
  } finally {
    storage.destroy();
    await database.end();
  }

  console.info(`PDF cleanup complete: ${removed} removed, ${pending} pending.`);
  if (pending > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[pdf-storage-cleanup] Cleanup could not run:', safeErrorCode(error));
  process.exitCode = 1;
});
