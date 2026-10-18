import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const databasePath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'mecseater.sqlite');
const dbDir = path.dirname(databasePath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');

export type ArrangementRecord = {
  id: number;
  exam_date: string;
  slot: string | null;
  pdf_name: string;
  pdf_path: string;
  student_count: number;
};

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seating_arrangements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_date TEXT NOT NULL,
      slot TEXT,
      pdf_name TEXT NOT NULL,
      pdf_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arrangement_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      roll_no TEXT NOT NULL,
      room_no TEXT NOT NULL,
      seat_no TEXT NOT NULL,
      FOREIGN KEY (arrangement_id) REFERENCES seating_arrangements(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_students_roll_no ON students(roll_no);
    CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique ON students(arrangement_id, roll_no, room_no, seat_no);
  `);
}

export function getActiveArrangement(): ArrangementRecord | null {
  const row = db
    .prepare(
      `SELECT id, exam_date, slot, pdf_name, pdf_path
       FROM seating_arrangements
       WHERE is_active = 1
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get() as { id: number; exam_date: string; slot: string | null; pdf_name: string; pdf_path: string } | undefined;

  if (!row) {
    return null;
  }

  const count = db
    .prepare(`SELECT COUNT(*) as total FROM students WHERE arrangement_id = ?`)
    .get(row.id) as { total: number };

  return {
    ...row,
    student_count: count.total,
  };
}

export function searchStudents(query: string) {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const arrangement = getActiveArrangement();
  if (!arrangement) {
    return [];
  }

  const pattern = `%${normalized}%`;
  const rows = db
    .prepare(
      `SELECT name, roll_no AS roll_no, room_no AS room_no, seat_no AS seat_no
       FROM students
       WHERE arrangement_id = ?
         AND (LOWER(roll_no) = LOWER(?) OR LOWER(name) LIKE LOWER(?))
       ORDER BY name ASC
       LIMIT 100`,
    )
    .all(arrangement.id, normalized, pattern) as Array<{
      name: string;
      roll_no: string;
      room_no: string;
      seat_no: string;
    }>;

  return rows;
}

export function replaceArrangement({ examDate, slot, pdfName, pdfPath, records }: { examDate: string; slot: string | null; pdfName: string; pdfPath: string; records: Array<{ name: string; rollNo: string; roomNo: string; seatNo: string }> }) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM seating_arrangements WHERE is_active = 1').run();

    const insertArrangement = db.prepare(
      `INSERT INTO seating_arrangements (exam_date, slot, pdf_name, pdf_path, is_active)
       VALUES (?, ?, ?, ?, 1)`,
    );
    const arrangementId = insertArrangement.run(examDate, slot || null, pdfName, pdfPath).lastInsertRowid as number;

    const insertStudent = db.prepare(
      `INSERT INTO students (arrangement_id, name, roll_no, room_no, seat_no)
       VALUES (?, ?, ?, ?, ?)`,
    );

    for (const record of records) {
      insertStudent.run(arrangementId, record.name, record.rollNo, record.roomNo, record.seatNo);
    }
  });

  tx();
}

export function deleteActiveArrangement() {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM seating_arrangements WHERE is_active = 1').run();
  });

  tx();
}

export function resetDatabaseForTests() {
  initializeDatabase();
  db.exec(`
    DELETE FROM students;
    DELETE FROM seating_arrangements;
  `);
}
