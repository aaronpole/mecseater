import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const bucketName = 'mecseater-pdfs';
const objectKeyPattern = /^arrangements\/[0-9a-f-]{36}\.pdf$/i;

let client: S3Client | undefined;

export class PdfStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfStorageConfigurationError';
  }
}

function getRequiredEnvironmentValue(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new PdfStorageConfigurationError(`${name} is required for private PDF storage.`);
  }
  return value;
}

function getClient() {
  if (client) {
    return client;
  }

  client = new S3Client({
    region: getRequiredEnvironmentValue('AWS_REGION'),
    endpoint: getRequiredEnvironmentValue('AWS_ENDPOINT_URL_S3'),
    credentials: {
      accessKeyId: getRequiredEnvironmentValue('AWS_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnvironmentValue('AWS_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
    maxAttempts: 3,
  });

  return client;
}

function assertObjectKey(objectKey: string) {
  if (!objectKeyPattern.test(objectKey)) {
    throw new Error('Invalid managed PDF object key.');
  }
}

export function isPdfStorageEnabled() {
  return process.env.PDF_STORAGE_ENABLED === '1';
}

export function assertPdfStorageConfigured() {
  if (!isPdfStorageEnabled()) {
    throw new PdfStorageConfigurationError('Private PDF storage is not enabled.');
  }
  getClient();
}

export function createPdfObjectKey() {
  return `arrangements/${randomUUID()}.pdf`;
}

export async function uploadPrivatePdf(objectKey: string, bytes: Buffer) {
  assertPdfStorageConfigured();
  assertObjectKey(objectKey);
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: bytes,
      ContentType: 'application/pdf',
    }),
  );
}

export async function deletePrivatePdf(objectKey: string) {
  assertObjectKey(objectKey);
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );
}

export function safeStorageErrorCode(error: unknown) {
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
