import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const migrationsDirectory = fileURLToPath(new URL('../lib/db/migrations/', import.meta.url));
const migrationLockKey = 1936028275;

class MigrationConfigurationError extends Error {}

function splitSqlStatements(source) {
  const statements = [];
  let start = 0;
  let index = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockCommentDepth = 0;
  let dollarQuote = null;

  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (current === '\n') lineComment = false;
      index += 1;
      continue;
    }

    if (blockCommentDepth > 0) {
      if (current === '/' && next === '*') {
        blockCommentDepth += 1;
        index += 2;
      } else if (current === '*' && next === '/') {
        blockCommentDepth -= 1;
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }

    if (dollarQuote) {
      if (source.startsWith(dollarQuote, index)) {
        index += dollarQuote.length;
        dollarQuote = null;
      } else {
        index += 1;
      }
      continue;
    }

    if (singleQuoted) {
      if (current === "'" && next === "'") {
        index += 2;
      } else {
        if (current === "'") singleQuoted = false;
        index += 1;
      }
      continue;
    }

    if (doubleQuoted) {
      if (current === '"' && next === '"') {
        index += 2;
      } else {
        if (current === '"') doubleQuoted = false;
        index += 1;
      }
      continue;
    }

    if (current === '-' && next === '-') {
      lineComment = true;
      index += 2;
    } else if (current === '/' && next === '*') {
      blockCommentDepth = 1;
      index += 2;
    } else if (current === "'") {
      singleQuoted = true;
      index += 1;
    } else if (current === '"') {
      doubleQuoted = true;
      index += 1;
    } else if (current === '$') {
      const tag = source.slice(index).match(/^\$[a-zA-Z_0-9]*\$/)?.[0];
      if (tag) {
        dollarQuote = tag;
        index += tag.length;
      } else {
        index += 1;
      }
    } else if (current === ';') {
      const statement = source.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
      index += 1;
    } else {
      index += 1;
    }
  }

  if (singleQuoted || doubleQuoted || blockCommentDepth > 0 || dollarQuote) {
    throw new Error('Migration contains an unterminated SQL construct.');
  }

  const remaining = source.slice(start).trim();
  if (remaining) statements.push(remaining);
  return statements;
}

async function main() {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (!connectionString) {
    throw new MigrationConfigurationError(
      'Set DATABASE_MIGRATION_URL explicitly to the database being migrated.',
    );
  }

  const parsedUrl = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new MigrationConfigurationError(
      'DATABASE_MIGRATION_URL must use the PostgreSQL protocol.',
    );
  }

  const sql = neon(connectionString);
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
    .sort();

  if (migrationFiles.length === 0) {
    throw new MigrationConfigurationError('No versioned database migrations were found.');
  }

  for (const file of migrationFiles) {
    const version = path.basename(file, '.sql');
    const schema = await sql`SELECT to_regclass('public.schema_migrations') AS migration_table`;
    let applied = false;

    if (schema[0]?.migration_table) {
      const versions = await sql`SELECT version FROM schema_migrations`;
      applied = versions.some((row) => row.version === version);
    }

    if (applied) {
      console.info(`Skipping already applied migration ${version}.`);
      continue;
    }

    const source = await readFile(path.join(migrationsDirectory, file), 'utf8');
    const statements = splitSqlStatements(source);
    if (statements.length === 0) {
      throw new MigrationConfigurationError(`Migration ${version} contains no SQL statements.`);
    }

    await sql.transaction((transaction) => [
      transaction`SELECT pg_advisory_xact_lock(${migrationLockKey}, 1)`,
      ...statements.map((statement) => transaction.query(statement)),
    ]);

    console.info(`Applied migration ${version}.`);
  }
}

main().catch((error) => {
  if (error instanceof MigrationConfigurationError) {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
    return;
  }

  const errorCode =
    error instanceof Error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : error instanceof Error
        ? error.name
        : 'UnknownError';
  console.error('Database migration failed:', errorCode);
  process.exitCode = 1;
});
