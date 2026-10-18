import { spawnSync } from 'node:child_process';
import path from 'node:path';

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
  const today = new Date(Date.UTC(referenceNow.getUTCFullYear(), referenceNow.getUTCMonth(), referenceNow.getUTCDate()));

  if (examDate < today) {
    return { valid: false, reason: 'This seating arrangement is dated in the past.' };
  }

  return { valid: true };
}

export function parsePdfFile(pdfPath: string): ParsedArrangement {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'parse_pdf.py');
  const result = spawnSync('py', ['-3', scriptPath, pdfPath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.status !== 0) {
    const output = `${result.stderr || result.stdout || 'Unable to parse PDF.'}`.trim();
    throw new Error(output || 'Unable to parse PDF.');
  }

  try {
    return JSON.parse(result.stdout) as ParsedArrangement;
  } catch {
    throw new Error('The PDF parser returned invalid JSON.');
  }
}
