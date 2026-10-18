import { describe, expect, it } from 'vitest';
import { parseDateFromText, validateExamDate } from '@/lib/pdf/parser';
import { initializeDatabase, resetDatabaseForTests, searchStudents, replaceArrangement } from '@/lib/db/database';

describe('parseDateFromText', () => {
  it('extracts the date from the PDF heading text', () => {
    const text = 'Slot 2 (S3 & S5 ) 14/10/2026 Wednesday';
    expect(parseDateFromText(text)).toBe('14/10/2026');
  });

  it('rejects invalid date strings', () => {
    expect(parseDateFromText('No valid date here')).toBeNull();
    expect(parseDateFromText('31/02/2026')).toBeNull();
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
});

describe('database search and replacement', () => {
  it('stores and searches the active arrangement', () => {
    resetDatabaseForTests();
    initializeDatabase();

    replaceArrangement({
      examDate: '14/10/2026',
      slot: 'Slot 2',
      pdfName: '14-10-2026 slot2.pdf',
      pdfPath: '/tmp/slot2.pdf',
      records: [
        { name: 'Alice Johnson', rollNo: '24ME001', roomNo: '107', seatNo: 'A01' },
        { name: 'Bob George', rollNo: '24ME002', roomNo: '107', seatNo: 'A02' },
      ],
    });

    expect(searchStudents('24ME001')).toEqual([
      {
        name: 'Alice Johnson',
        roll_no: '24ME001',
        room_no: '107',
        seat_no: 'A01',
      },
    ]);

    expect(searchStudents('alice')).toHaveLength(1);
    expect(searchStudents('unknown')).toEqual([]);
    resetDatabaseForTests();
  });
});
