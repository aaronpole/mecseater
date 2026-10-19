import { describe, expect, it } from 'vitest';
import { parseDateFromText, validateExamDate } from '@/lib/pdf/parser';

describe('parseDateFromText', () => {
  it('extracts the date from the PDF heading text', () => {
    const text = 'Slot 2 (S3 & S5 ) 14/10/2026 Wednesday';
    expect(parseDateFromText(text)).toBe('14/10/2026');
  });

  it('rejects invalid date strings', () => {
    expect(parseDateFromText('No valid date here')).toBeNull();
    expect(parseDateFromText('31/02/2026')).toBeNull();
  });

  it('accepts valid leap-day dates', () => {
    expect(parseDateFromText('29/02/2028')).toBe('29/02/2028');
  });
});

describe('validateExamDate', () => {
  it('accepts a future exam date', () => {
    const future = new Date(Date.UTC(2030, 0, 1));
    expect(validateExamDate('01/01/2030', future)).toMatchObject({ valid: true });
  });

  it('rejects a past exam date', () => {
    const past = new Date(Date.UTC(2020, 0, 1));
    expect(validateExamDate('01/01/2019', past)).toMatchObject({ valid: false });
  });

  it('accepts an exam scheduled for today', () => {
    const today = new Date('2026-10-18T06:30:00.000Z');
    expect(validateExamDate('18/10/2026', today)).toMatchObject({ valid: true });
  });

  it('uses Asia/Kolkata calendar dates for past-date validation', () => {
    const lateUtc = new Date('2026-10-18T20:00:00.000Z');
    expect(validateExamDate('18/10/2026', lateUtc)).toMatchObject({ valid: false });
    expect(validateExamDate('19/10/2026', lateUtc)).toMatchObject({ valid: true });
  });

  it('rejects impossible calendar dates', () => {
    const reference = new Date(Date.UTC(2026, 0, 1));
    expect(validateExamDate('31/02/2026', reference)).toMatchObject({ valid: false });
  });
});
