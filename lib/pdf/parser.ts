import { z } from 'zod';

export type StudentRecord = {
  name: string;
  rollNo: string;
  roomNo: string;
  seatNo: string;
};

export type ParsedArrangement = {
  examDate: string;
  slot: string | null;
  records: StudentRecord[];
};

export class PdfParserServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PdfParserServiceError';
  }
}

const parsedArrangementSchema = z.object({
  examDate: z.string(),
  slot: z.string().nullable(),
  records: z.array(
    z.object({
      name: z.string().trim().min(1),
      rollNo: z.string().trim().min(1),
      roomNo: z.string().trim().min(1),
      seatNo: z.string().trim().min(1),
    }),
  ).min(1),
});

export function parseDateFromText(text: string): string | null {
  const match = text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  if (!match) {
    return null;
  }

  const value = match[1];
  const [dd, mm, yyyy] = value.split('/').map(Number);
  if (Number.isNaN(dd) || Number.isNaN(mm) || Number.isNaN(yyyy)) {
    return null;
  }

  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) {
    return null;
  }

  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const normalizedYear = date.getUTCFullYear();
  const normalizedMonth = date.getUTCMonth();
  const normalizedDay = date.getUTCDate();

  if (normalizedYear !== yyyy || normalizedMonth !== mm - 1 || normalizedDay !== dd) {
    return null;
  }

  return value;
}

export function validateExamDate(value: string, referenceNow = new Date()) {
  const parsed = parseDateFromText(value);
  if (!parsed) {
    return { valid: false, reason: 'Exam date is missing or invalid in the PDF.' };
  }

  const [dd, mm, yyyy] = parsed.split('/').map(Number);
  const examDate = new Date(Date.UTC(yyyy, mm - 1, dd));
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceNow);
  const todayValues = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]));
  const today = new Date(
    Date.UTC(Number(todayValues.year), Number(todayValues.month) - 1, Number(todayValues.day)),
  );

  if (examDate < today) {
    return { valid: false, reason: 'This seating arrangement is dated in the past.' };
  }

  return { valid: true };
}

export async function parsePdfBytes(pdfBytes: Buffer): Promise<ParsedArrangement> {
  const parserUrl = process.env.PDF_PARSER_URL;
  const parserSecret = process.env.PDF_PARSER_SECRET;

  if (!parserUrl || !parserSecret) {
    throw new PdfParserServiceError('PDF parser service is not configured.', 500);
  }

  let response: Response;
  try {
    const baseUrl = parserUrl.replace(/\/+$/, '');
    response = await fetch(new URL('parse', `${baseUrl}/`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${parserSecret}`,
        'Content-Type': 'application/pdf',
      },
      body: new Uint8Array(pdfBytes),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new PdfParserServiceError(
      timedOut ? 'PDF parsing timed out.' : 'Unable to reach the PDF parser service.',
      timedOut ? 504 : 502,
    );
  }

  if (!response.ok) {
    if (response.status === 413) {
      throw new PdfParserServiceError('PDF exceeds the parser size limit.', 413);
    }
    if (response.status === 422) {
      throw new PdfParserServiceError('PDF could not be parsed.', 400);
    }
    throw new PdfParserServiceError('PDF parser service returned an error.', 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PdfParserServiceError('PDF parser service returned an invalid response.', 502);
  }

  const result = parsedArrangementSchema.safeParse(payload);
  if (!result.success || !parseDateFromText(result.data.examDate) || result.data.examDate !== parseDateFromText(result.data.examDate)) {
    throw new PdfParserServiceError('PDF parser service returned invalid parsed data.', 502);
  }

  const rollNumbers = new Set<string>();
  const seats = new Set<string>();
  for (const record of result.data.records) {
    const roomSeat = `${record.roomNo}\u0000${record.seatNo}`;
    if (rollNumbers.has(record.rollNo.toLowerCase()) || seats.has(roomSeat.toLowerCase())) {
      throw new PdfParserServiceError('PDF parser service returned conflicting student records.', 502);
    }
    rollNumbers.add(record.rollNo.toLowerCase());
    seats.add(roomSeat.toLowerCase());
  }

  return result.data;
}
