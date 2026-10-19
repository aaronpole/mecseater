import { neon } from '@neondatabase/serverless';

const testMarker = 'mecseater_test_database_guard_v1';

class TestDatabaseConfigurationError extends Error {}

function parseConnectionString(value, variableName) {
  try {
    return new URL(value);
  } catch {
    throw new TestDatabaseConfigurationError(
      `${variableName} must be a valid PostgreSQL connection URL.`,
    );
  }
}

function endpointHostname(url) {
  const hostname = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, '');
  return hostname;
}

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL;
  const appUrl = process.env.DATABASE_URL;
  if (!testUrl || !appUrl) {
    throw new TestDatabaseConfigurationError(
      'Set separate TEST_DATABASE_URL and DATABASE_URL values before preparing the test database.',
    );
  }

  const testDatabase = parseConnectionString(testUrl, 'TEST_DATABASE_URL');
  const appDatabase = parseConnectionString(appUrl, 'DATABASE_URL');
  if (!['postgres:', 'postgresql:'].includes(testDatabase.protocol)) {
    throw new TestDatabaseConfigurationError('TEST_DATABASE_URL must use the PostgreSQL protocol.');
  }
  if (!['postgres:', 'postgresql:'].includes(appDatabase.protocol)) {
    throw new TestDatabaseConfigurationError('DATABASE_URL must use the PostgreSQL protocol.');
  }
  if (!testDatabase.hostname.toLowerCase().endsWith('.neon.tech')) {
    throw new TestDatabaseConfigurationError('The PostgreSQL integration database must be hosted by Neon.');
  }
  if (endpointHostname(testDatabase) === endpointHostname(appDatabase)) {
    throw new TestDatabaseConfigurationError('TEST_DATABASE_URL must use a different Neon endpoint from DATABASE_URL.');
  }

  const databaseName = decodeURIComponent(testDatabase.pathname.slice(1));
  if (!/[_-]test$/i.test(databaseName)) {
    throw new TestDatabaseConfigurationError(
      'The isolated Neon test database name must end in "_test" or "-test".',
    );
  }

  const sql = neon(testUrl);
  const schema = await sql`
    SELECT to_regclass('public.schema_migrations') AS migration_table,
           to_regclass('public.seating_arrangements') AS arrangements,
           to_regclass('public.students') AS students
  `;
  if (!schema[0]?.migration_table || !schema[0]?.arrangements || !schema[0]?.students) {
    throw new TestDatabaseConfigurationError(
      'Apply the versioned PostgreSQL schema to TEST_DATABASE_URL first.',
    );
  }

  const counts = await sql`
    SELECT (SELECT COUNT(*)::integer FROM seating_arrangements) AS arrangements,
           (SELECT COUNT(*)::integer FROM students) AS students
  `;
  if (counts[0]?.arrangements !== 0 || counts[0]?.students !== 0) {
    throw new TestDatabaseConfigurationError(
      'The isolated Neon test database must be empty before it can be marked for tests.',
    );
  }

  await sql`
    INSERT INTO schema_migrations (version)
    VALUES (${testMarker})
    ON CONFLICT (version) DO NOTHING
  `;
  console.info('The empty isolated Neon database is marked for integration tests.');
}

main().catch((error) => {
  if (error instanceof TestDatabaseConfigurationError) {
    console.error('Test database preparation failed:', error.message);
    process.exitCode = 1;
    return;
  }

  const errorCode =
    error instanceof Error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : error instanceof Error
        ? error.name
        : 'UnknownError';
  console.error('Test database preparation failed:', errorCode);
  process.exitCode = 1;
});
