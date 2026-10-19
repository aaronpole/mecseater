import { attachDatabasePool } from '@vercel/functions';
import { Pool, type PoolClient } from 'pg';

export type ArrangementRecord = {
  id: number;
  exam_date: string;
  slot: string | null;
  pdf_name: string;
  student_count: number;
};

type StudentRecord = {
  name: string;
  rollNo: string;
  roomNo: string;
  seatNo: string;
};

type ArrangementInput = {
  examDate: string;
  slot: string | null;
  pdfName: string;
  pdfPath: string;
  records: StudentRecord[];
};

type ActiveArrangementRow = {
  id: string;
  exam_date: string;
  slot: string | null;
  pdf_name: string;
  pdf_path: string;
  student_count: number;
};

type StudentSearchRow = {
  name: string;
  roll_no: string;
  room_no: string;
  seat_no: string;
};

let databasePool: Pool | undefined;

function getDatabasePool() {
  if (databasePool) {
    return databasePool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required.');
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    maxUses: 1_000,
  });
  pool.on('error', (error) => {
    const errorCode = 'code' in error && typeof error.code === 'string' ? error.code : error.name;
    console.error('[database] Idle connection error:', errorCode);
  });

  if (process.env.VERCEL) {
    attachDatabasePool(pool);
  }

  databasePool = pool;
  return pool;
}

async function withArrangementLock<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDatabasePool().connect();
  let transactionStarted = false;
  let discardClient = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [1936028275, 1]);

    const result = await operation(client);
    await client.query('COMMIT');
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
        transactionStarted = false;
      } catch (rollbackError) {
        discardClient = true;
        throw new AggregateError(
          [error, rollbackError],
          'The database operation failed and its transaction could not be rolled back.',
        );
      }
    }

    throw error;
  } finally {
    client.release(discardClient);
  }
}

export async function getActiveArrangement(): Promise<ArrangementRecord | null> {
  const { rows } = await getDatabasePool().query<ActiveArrangementRow>(`
    SELECT arrangement.id, arrangement.exam_date, arrangement.slot,
           arrangement.pdf_name, arrangement.pdf_path,
           COUNT(student.id)::integer AS student_count
    FROM seating_arrangements AS arrangement
    LEFT JOIN students AS student ON student.arrangement_id = arrangement.id
    WHERE arrangement.is_active = TRUE
    GROUP BY arrangement.id
    LIMIT 1
  `);

  if (!rows[0]) {
    return null;
  }

  return {
    id: Number(rows[0].id),
    exam_date: rows[0].exam_date,
    slot: rows[0].slot,
    pdf_name: rows[0].pdf_name,
    student_count: Number(rows[0].student_count),
  };
}

export async function queuePdfCleanup(objectKey: string): Promise<void> {
  await getDatabasePool().query(
    `INSERT INTO pdf_cleanup_queue (object_key, status)
     VALUES ($1, 'staging')
     ON CONFLICT (object_key)
     DO UPDATE SET status = 'staging', queued_at = now()`,
    [objectKey],
  );
}

export async function markPdfCleanupQueued(objectKey: string): Promise<void> {
  await getDatabasePool().query(
    `UPDATE pdf_cleanup_queue
     SET status = 'queued', queued_at = now()
     WHERE object_key = $1`,
    [objectKey],
  );
}

export async function getPendingPdfCleanupKeys(limit: number): Promise<string[]> {
  await getDatabasePool().query(
    `UPDATE pdf_cleanup_queue
     SET status = 'queued', queued_at = now()
     WHERE status = 'staging'
       AND queued_at < now() - INTERVAL '30 minutes'`,
  );

  const { rows } = await getDatabasePool().query<{ object_key: string }>(
    `SELECT object_key
     FROM pdf_cleanup_queue
     WHERE status = 'queued'
     ORDER BY queued_at ASC
     LIMIT $1`,
    [limit],
  );

  return rows.map(({ object_key }) => object_key);
}

export async function removePdfCleanupKey(objectKey: string): Promise<void> {
  await getDatabasePool().query(
    'DELETE FROM pdf_cleanup_queue WHERE object_key = $1',
    [objectKey],
  );
}

export async function searchStudents(query: string): Promise<StudentSearchRow[]> {
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const pattern = `%${normalized}%`;
  const { rows } = await getDatabasePool().query<StudentSearchRow>(
    `SELECT student.name,
            student.roll_no AS roll_no,
            student.room_no AS room_no,
            student.seat_no AS seat_no
     FROM students AS student
     INNER JOIN seating_arrangements AS arrangement
       ON arrangement.id = student.arrangement_id
     WHERE arrangement.is_active = TRUE
       AND (LOWER(student.roll_no) = LOWER($1)
            OR LOWER(student.name) LIKE LOWER($2))
     ORDER BY student.name ASC
     LIMIT 100`,
    [normalized, pattern],
  );

  return rows;
}

export async function replaceArrangement({
  examDate,
  slot,
  pdfName,
  pdfPath,
  records,
}: ArrangementInput): Promise<ArrangementRecord> {
  const serializedRecords = JSON.stringify(
    records.map(({ name, rollNo, roomNo, seatNo }) => ({
      name,
      roll_no: rollNo,
      room_no: roomNo,
      seat_no: seatNo,
    })),
  );

  return withArrangementLock(async (client) => {
    const { rows: previousRows } = await client.query<{ pdf_path: string }>(
      `SELECT pdf_path
       FROM seating_arrangements
       WHERE is_active = TRUE
       FOR UPDATE`,
    );

    await client.query(
      'UPDATE seating_arrangements SET is_active = FALSE WHERE is_active = TRUE',
    );

    const { rows } = await client.query<ActiveArrangementRow>(
      `WITH inserted_arrangement AS (
         INSERT INTO seating_arrangements (exam_date, slot, pdf_name, pdf_path, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id, exam_date, slot, pdf_name, pdf_path
       ),
       inserted_students AS (
         INSERT INTO students (arrangement_id, name, roll_no, room_no, seat_no)
         SELECT inserted_arrangement.id, student.name, student.roll_no,
                student.room_no, student.seat_no
         FROM inserted_arrangement
         CROSS JOIN jsonb_to_recordset($5::jsonb)
           AS student(name text, roll_no text, room_no text, seat_no text)
         RETURNING id
       )
       SELECT inserted_arrangement.id,
              inserted_arrangement.exam_date,
              inserted_arrangement.slot,
              inserted_arrangement.pdf_name,
              inserted_arrangement.pdf_path,
              (SELECT COUNT(*)::integer FROM inserted_students) AS student_count
       FROM inserted_arrangement`,
      [examDate, slot || null, pdfName, pdfPath, serializedRecords],
    );

    const inserted = rows[0];
    if (!inserted) {
      throw new Error('PostgreSQL did not return the inserted arrangement.');
    }

    if (previousRows[0]) {
      await client.query(
        `INSERT INTO pdf_cleanup_queue (object_key)
         VALUES ($1)
         ON CONFLICT (object_key)
         DO UPDATE SET status = 'queued', queued_at = now()`,
        [previousRows[0].pdf_path],
      );
    }
    await client.query(
      'DELETE FROM pdf_cleanup_queue WHERE object_key = $1',
      [pdfPath],
    );

    return {
      id: Number(inserted.id),
      exam_date: inserted.exam_date,
      slot: inserted.slot,
      pdf_name: inserted.pdf_name,
      student_count: Number(inserted.student_count),
    };
  });
}

export async function deleteActiveArrangement(): Promise<void> {
  await withArrangementLock(async (client) => {
    const { rows: activeRows } = await client.query<{ pdf_path: string }>(
      `SELECT pdf_path
       FROM seating_arrangements
       WHERE is_active = TRUE
       FOR UPDATE`,
    );

    if (activeRows[0]) {
      await client.query(
        `INSERT INTO pdf_cleanup_queue (object_key)
         VALUES ($1)
         ON CONFLICT (object_key)
         DO UPDATE SET status = 'queued', queued_at = now()`,
        [activeRows[0].pdf_path],
      );
    }

    await client.query('DELETE FROM seating_arrangements WHERE is_active = TRUE');
  });
}
