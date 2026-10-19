import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const integrationRequested = process.env.RUN_POSTGRES_INTEGRATION_TESTS === '1';
const postgresDescribe = integrationRequested ? describe : describe.skip;
const postgresTestTimeout = 30_000;

type DatabaseRepository = typeof import('@/lib/db/database');

let repository: DatabaseRepository;
let cleanupTestData: () => Promise<void>;
let testPool: Pool | undefined;

function getTestPool() {
  if (!testPool) {
    throw new Error('The isolated PostgreSQL test database has not been initialized.');
  }

  return testPool;
}

function parseDatabaseUrl(value: string, variableName: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL.`);
  }
}

function endpointHostname(url: URL) {
  return url.hostname.toLowerCase().replace(/-pooler(?=\.)/, '');
}

async function expectTestDatabaseEmpty() {
  const { rows } = await getTestPool().query<{
    arrangements: number;
    students: number;
    cleanup_entries: number;
  }>(`SELECT (SELECT COUNT(*)::integer FROM seating_arrangements) AS arrangements,
             (SELECT COUNT(*)::integer FROM students) AS students,
             (SELECT COUNT(*)::integer FROM pdf_cleanup_queue) AS cleanup_entries`);

  if (rows[0]?.arrangements !== 0 || rows[0]?.students !== 0 || rows[0]?.cleanup_entries !== 0) {
    throw new Error('The isolated PostgreSQL test database must be empty before tests run.');
  }
}

postgresDescribe('PostgreSQL repository integration', () => {
  beforeAll(async () => {
    const testUrl = process.env.TEST_DATABASE_URL;
    if (!testUrl) {
      throw new Error('TEST_DATABASE_URL is required when PostgreSQL integration tests are enabled.');
    }

    const testDatabase = parseDatabaseUrl(testUrl, 'TEST_DATABASE_URL');
    if (!['postgres:', 'postgresql:'].includes(testDatabase.protocol)) {
      throw new Error('TEST_DATABASE_URL must use the PostgreSQL protocol.');
    }
    if (!testDatabase.hostname.toLowerCase().endsWith('.neon.tech')) {
      throw new Error('PostgreSQL integration tests must use an isolated Neon database.');
    }

    const databaseName = decodeURIComponent(testDatabase.pathname.slice(1));
    if (!/[_-]test$/i.test(databaseName)) {
      throw new Error('The isolated Neon test database name must end in "_test" or "-test".');
    }

    const configuredDatabase = process.env.DATABASE_URL;
    if (!configuredDatabase) {
      throw new Error('Set DATABASE_URL to a separate development database before enabling integration tests.');
    }
    const appDatabase = parseDatabaseUrl(configuredDatabase, 'DATABASE_URL');
    if (!['postgres:', 'postgresql:'].includes(appDatabase.protocol)) {
      throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
    }
    if (endpointHostname(appDatabase) === endpointHostname(testDatabase)) {
      throw new Error('TEST_DATABASE_URL must use a different Neon endpoint from DATABASE_URL.');
    }

    process.env.DATABASE_URL = testUrl;
    testPool = new Pool({ connectionString: testUrl, max: 2 });
    const { rows: schema } = await getTestPool().query<{
      migration_table: string | null;
      arrangements: string | null;
      students: string | null;
    }>(`SELECT to_regclass('public.schema_migrations') AS migration_table,
               to_regclass('public.seating_arrangements') AS arrangements,
               to_regclass('public.students') AS students`);

    if (!schema[0]?.arrangements || !schema[0]?.students) {
      throw new Error('Apply the versioned schema manually to TEST_DATABASE_URL before running integration tests.');
    }

    const { rows: marker } = await getTestPool().query(
      `SELECT version
       FROM schema_migrations
       WHERE version = 'mecseater_test_database_guard_v1'`,
    );
    if (!marker[0]) {
      throw new Error('Prepare the empty isolated Neon test database before running integration tests.');
    }

    cleanupTestData = async () => {
      await testPool?.query(
        `DELETE FROM seating_arrangements
         WHERE pdf_path LIKE '/private/test/%'`,
      );
      await testPool?.query(
        `DELETE FROM pdf_cleanup_queue
         WHERE object_key LIKE '/private/test/%'`,
      );
    };
    repository = await import('@/lib/db/database');
    await expectTestDatabaseEmpty();
  }, postgresTestTimeout);

  beforeEach(async () => {
    await cleanupTestData();
    await expectTestDatabaseEmpty();
  }, postgresTestTimeout);

  afterAll(async () => {
    if (cleanupTestData) {
      await cleanupTestData();
    }
    await testPool?.end();
  }, postgresTestTimeout);

  it('preserves exact-roll and case-insensitive name-substring search behavior', async () => {
    await repository.replaceArrangement({
      examDate: '14/10/2030',
      slot: 'Fixture Slot',
      pdfName: 'synthetic-fixture.pdf',
      pdfPath: '/private/test/synthetic-fixture.pdf',
      records: [
        { name: 'Synthetic Student', rollNo: 'TEST001', roomNo: '107', seatNo: 'A01' },
        { name: 'Another Fixture', rollNo: 'TEST002', roomNo: '107', seatNo: 'A02' },
      ],
    });

    await expect(repository.searchStudents('test001')).resolves.toEqual([
      { name: 'Synthetic Student', roll_no: 'TEST001', room_no: '107', seat_no: 'A01' },
    ]);
    await expect(repository.searchStudents('synthetic')).resolves.toEqual([
      { name: 'Synthetic Student', roll_no: 'TEST001', room_no: '107', seat_no: 'A01' },
    ]);
  }, postgresTestTimeout);

  it('keeps the previous active dataset when inserting invalid records fails', async () => {
    await repository.replaceArrangement({
      examDate: '14/10/2030',
      slot: 'Previous',
      pdfName: 'previous.pdf',
      pdfPath: '/private/test/previous.pdf',
      records: [{ name: 'Previous Fixture', rollNo: 'TEST001', roomNo: '107', seatNo: 'A01' }],
    });

    await expect(
      repository.replaceArrangement({
        examDate: '15/10/2030',
        slot: 'Invalid',
        pdfName: 'invalid.pdf',
        pdfPath: '/private/test/invalid.pdf',
        records: [
          { name: 'Fixture One', rollNo: 'DUP001', roomNo: '108', seatNo: 'A01' },
          { name: 'Fixture Two', rollNo: 'DUP001', roomNo: '108', seatNo: 'A02' },
        ],
      }),
    ).rejects.toBeDefined();

    await expect(repository.getActiveArrangement()).resolves.toMatchObject({
      pdf_name: 'previous.pdf',
      student_count: 1,
    });
    await expect(repository.searchStudents('TEST001')).resolves.toHaveLength(1);
  }, postgresTestTimeout);

  it('queues the replaced PDF and retains the newly active PDF atomically', async () => {
    await repository.replaceArrangement({
      examDate: '14/10/2030',
      slot: 'Prior PDF',
      pdfName: 'prior.pdf',
      pdfPath: '/private/test/prior.pdf',
      records: [{ name: 'Prior Fixture', rollNo: 'PRIOR001', roomNo: '107', seatNo: 'A01' }],
    });
    await repository.replaceArrangement({
      examDate: '15/10/2030',
      slot: 'Next PDF',
      pdfName: 'next.pdf',
      pdfPath: '/private/test/next.pdf',
      records: [{ name: 'Next Fixture', rollNo: 'NEXT001', roomNo: '108', seatNo: 'A01' }],
    });

    const { rows: queue } = await getTestPool().query<{ object_key: string; status: string }>(
      `SELECT object_key, status
       FROM pdf_cleanup_queue
       ORDER BY object_key`,
    );
    expect(queue).toEqual([{ object_key: '/private/test/prior.pdf', status: 'queued' }]);
    await expect(repository.getActiveArrangement()).resolves.toMatchObject({ pdf_name: 'next.pdf' });
  }, postgresTestTimeout);

  it('enforces the single-active-arrangement partial unique index', async () => {
    await repository.replaceArrangement({
      examDate: '14/10/2030',
      slot: 'Unique active fixture',
      pdfName: 'unique-active.pdf',
      pdfPath: '/private/test/unique-active.pdf',
      records: [{ name: 'Unique Active Fixture', rollNo: 'UNIQUE001', roomNo: '112', seatNo: 'A01' }],
    });

    await expect(
      getTestPool().query(
        `INSERT INTO seating_arrangements (exam_date, slot, pdf_name, pdf_path, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          '15/10/2030',
          'Invalid second active',
          'second-active.pdf',
          '/private/test/second-active.pdf',
          true,
        ],
      ),
    ).rejects.toMatchObject({ code: '23505' });

    const { rows: activeRows } = await getTestPool().query<{ total: number }>(
      `SELECT COUNT(*)::integer AS total
       FROM seating_arrangements
       WHERE is_active = TRUE`,
    );
    expect(activeRows[0]?.total).toBe(1);
    await expect(repository.searchStudents('UNIQUE001')).resolves.toHaveLength(1);
  }, postgresTestTimeout);

  it('serializes concurrent replacements and leaves exactly one active dataset', async () => {
    await Promise.all(
      ['concurrent-a.pdf', 'concurrent-b.pdf'].map((pdfName, index) =>
        repository.replaceArrangement({
          examDate: '14/10/2030',
          slot: `Concurrent ${index}`,
          pdfName,
          pdfPath: `/private/test/${pdfName}`,
          records: [
            {
              name: `Concurrent Fixture ${index}`,
              rollNo: `CONCURRENT00${index}`,
              roomNo: '109',
              seatNo: `A0${index + 1}`,
            },
          ],
        }),
      ),
    );

    const active = await repository.getActiveArrangement();
    expect(active?.pdf_name).toMatch(/^concurrent-[ab]\.pdf$/);
    expect(active?.student_count).toBe(1);
    await expect(repository.searchStudents('CONCURRENT')).resolves.toHaveLength(1);

    const { rows: activeRows } = await getTestPool().query<{ total: number }>(
      `SELECT COUNT(*)::integer AS total
       FROM seating_arrangements
       WHERE is_active = TRUE`,
    );
    expect(activeRows[0]?.total).toBe(1);
  }, postgresTestTimeout);

  it('serializes concurrent deletions and replacements without violating dataset ownership', async () => {
    await repository.replaceArrangement({
      examDate: '14/10/2030',
      slot: 'Concurrent delete seed',
      pdfName: 'delete-seed.pdf',
      pdfPath: '/private/test/delete-seed.pdf',
      records: [{ name: 'Delete Seed Fixture', rollNo: 'DELETESEED', roomNo: '110', seatNo: 'A01' }],
    });

    await Promise.all([
      repository.deleteActiveArrangement(),
      repository.replaceArrangement({
        examDate: '15/10/2030',
        slot: 'Concurrent replacement',
        pdfName: 'delete-race-replacement.pdf',
        pdfPath: '/private/test/delete-race-replacement.pdf',
        records: [{ name: 'Replacement Fixture', rollNo: 'RACE001', roomNo: '111', seatNo: 'A01' }],
      }),
      repository.deleteActiveArrangement(),
    ]);

    const { rows: state } = await getTestPool().query<{
      active_arrangements: number;
      active_students: number;
      misassigned_students: number;
    }>(`SELECT COUNT(DISTINCT arrangement.id)::integer AS active_arrangements,
               COUNT(student.id)::integer AS active_students,
               COUNT(*) FILTER (
                 WHERE student.id IS NOT NULL
                   AND student.arrangement_id <> arrangement.id
               )::integer AS misassigned_students
        FROM seating_arrangements AS arrangement
        LEFT JOIN students AS student
          ON student.arrangement_id = arrangement.id
        WHERE arrangement.is_active = TRUE`);

    expect(state[0]?.active_arrangements).toBeLessThanOrEqual(1);
    expect(state[0]?.misassigned_students).toBe(0);
    if (state[0]?.active_arrangements === 1) {
      await expect(repository.getActiveArrangement()).resolves.toMatchObject({
        pdf_name: 'delete-race-replacement.pdf',
        student_count: 1,
      });
      await expect(repository.searchStudents('RACE001')).resolves.toHaveLength(1);
    } else {
      await expect(repository.getActiveArrangement()).resolves.toBeNull();
      await expect(repository.searchStudents('RACE001')).resolves.toEqual([]);
    }
  }, postgresTestTimeout);

  it('deletes only the active arrangement and its associated records', async () => {
    await repository.replaceArrangement({
      examDate: '14/10/2030',
      slot: 'Delete fixture',
      pdfName: 'delete-fixture.pdf',
      pdfPath: '/private/test/delete-fixture.pdf',
      records: [{ name: 'Delete Fixture', rollNo: 'DELETE001', roomNo: '110', seatNo: 'A01' }],
    });

    await repository.deleteActiveArrangement();

    await expect(repository.getActiveArrangement()).resolves.toBeNull();
    await expect(repository.searchStudents('DELETE001')).resolves.toEqual([]);
    const { rows: queue } = await getTestPool().query<{ object_key: string; status: string }>(
      `SELECT object_key, status
       FROM pdf_cleanup_queue`,
    );
    expect(queue).toEqual([{ object_key: '/private/test/delete-fixture.pdf', status: 'queued' }]);
  }, postgresTestTimeout);
});
