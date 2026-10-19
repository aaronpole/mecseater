import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePdfBytes, PdfParserServiceError } from '@/lib/pdf/parser';

const parsedArrangement = {
  examDate: '18/10/2026',
  slot: 'Slot 2',
  records: [{ name: 'Synthetic Student', rollNo: '24ME001', roomNo: '107', seatNo: 'A01' }],
};

describe('parsePdfBytes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends PDF bytes to the authenticated parser service and validates its response', async () => {
    vi.stubEnv('PDF_PARSER_URL', 'http://127.0.0.1:8000/');
    vi.stubEnv('PDF_PARSER_SECRET', 'test-only-secret');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(parsedArrangement), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const pdfBytes = Buffer.from('%PDF-synthetic');

    await expect(parsePdfBytes(pdfBytes)).resolves.toEqual(parsedArrangement);

    const [url, request] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://127.0.0.1:8000/parse');
    expect(request.method).toBe('POST');
    expect(new Headers(request.headers).get('authorization')).toBe('Bearer test-only-secret');
    expect(new Headers(request.headers).get('content-type')).toBe('application/pdf');
    expect(Buffer.from(request.body as Uint8Array)).toEqual(pdfBytes);
  });

  it('fails explicitly when parser service configuration is missing', async () => {
    vi.stubEnv('PDF_PARSER_URL', '');
    vi.stubEnv('PDF_PARSER_SECRET', '');

    await expect(parsePdfBytes(Buffer.from('%PDF-synthetic'))).rejects.toMatchObject({
      name: 'PdfParserServiceError',
      status: 500,
    });
  });

  it('rejects malformed parser responses and empty record lists', async () => {
    vi.stubEnv('PDF_PARSER_URL', 'http://127.0.0.1:8000');
    vi.stubEnv('PDF_PARSER_SECRET', 'test-only-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...parsedArrangement, records: [] }), { status: 200 })));

    await expect(parsePdfBytes(Buffer.from('%PDF-synthetic'))).rejects.toMatchObject({ status: 502 });
  });

  it('maps invalid PDFs to a client error without exposing parser internals', async () => {
    vi.stubEnv('PDF_PARSER_URL', 'http://127.0.0.1:8000');
    vi.stubEnv('PDF_PARSER_SECRET', 'test-only-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private parser detail', { status: 422 })));

    await expect(parsePdfBytes(Buffer.from('%PDF-synthetic'))).rejects.toMatchObject({
      name: 'PdfParserServiceError',
      status: 400,
      message: 'PDF could not be parsed.',
    });
  });

  it('maps service timeouts to a gateway timeout', async () => {
    vi.stubEnv('PDF_PARSER_URL', 'http://127.0.0.1:8000');
    vi.stubEnv('PDF_PARSER_SECRET', 'test-only-secret');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError')));

    await expect(parsePdfBytes(Buffer.from('%PDF-synthetic'))).rejects.toBeInstanceOf(PdfParserServiceError);
    await expect(parsePdfBytes(Buffer.from('%PDF-synthetic'))).rejects.toMatchObject({ status: 504 });
  });

  it('maps parser service failures to a bad gateway', async () => {
    vi.stubEnv('PDF_PARSER_URL', 'http://127.0.0.1:8000');
    vi.stubEnv('PDF_PARSER_SECRET', 'test-only-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(parsePdfBytes(Buffer.from('%PDF-synthetic'))).rejects.toMatchObject({ status: 502 });
  });
});
