# Mecseater

Mecseater lets an administrator upload an exam seating-arrangement PDF and lets students search the extracted seating records by name or roll number.

## Requirements

- Node.js 18.17 or later and npm
- Python 3.12 or later for the PDF parser service
- A PostgreSQL database for application persistence

Install the PDF parser service and test dependencies:

```powershell
py -3 -m pip install -r services/pdf-parser/requirements-test.txt
```

## Getting started

Install the JavaScript dependencies:

```powershell
npm ci
```

Create a local environment file from the example:

```powershell
Copy-Item .env.example .env.local
```

Set `ADMIN_PASSWORD_HASH` in `.env.local` to a bcrypt hash for your chosen admin password. Generate one without putting the password in shell history:

```powershell
$password = Read-Host "Admin password" -AsSecureString
$plainPassword = [System.Net.NetworkCredential]::new("", $password).Password
npm run generate:hash -- "$plainPassword"
Remove-Variable plainPassword, password
```

Copy the resulting hash into `.env.local`. Set `ADMIN_USERNAME` to the username you want to use; if omitted, the application uses `admin`. Do not commit `.env.local` or share your password or hash.

Set `PDF_PARSER_SECRET` in `.env.local` to a random value used only by the Next.js server and parser service. For local development, keep `PDF_PARSER_URL` set to `http://127.0.0.1:8000`. Start the parser service in one terminal:

```powershell
$env:PDF_PARSER_SECRET = "<same value as PDF_PARSER_SECRET in .env.local>"
py -3 -m uvicorn main:app --app-dir services/pdf-parser --host 127.0.0.1 --port 8000
```

Start the Next.js development server in another terminal:

```powershell
npm run dev
```

Set `DATABASE_URL` in `.env.local` to the pooled PostgreSQL connection URL before starting the application. The app uses `pg` and attaches its pool to Vercel's Fluid lifecycle. Neon also provides `DATABASE_URL_UNPOOLED`, which is the direct connection for manual schema migrations. To initialize a database, set `DATABASE_MIGRATION_URL` to that direct connection and run:

```powershell
npm run db:migrate
```

Migrations are manual and are never run by application startup or requests. Do not point the migration command at production without explicit review and approval. Keep a separate, empty Neon endpoint and database for integration tests; the tests require both `RUN_POSTGRES_INTEGRATION_TESTS=1` and a `TEST_DATABASE_URL` whose database name ends in `_test` or `-test`.

Run the PostgreSQL integration tests only against an empty Neon database dedicated to tests. Use a distinct Neon endpoint and database; the test database name must end in `_test` or `-test`. The test suite refuses other providers, a shared Neon endpoint, and databases with pre-existing application rows. It only cleans up fixture arrangements stored under `/private/test/`.

```powershell
$readConnectionString = {
  param([string]$Prompt)
  $secureValue = Read-Host $Prompt -AsSecureString
  [System.Net.NetworkCredential]::new("", $secureValue).Password
}
$env:DATABASE_URL = & $readConnectionString "Development PostgreSQL URL"
$env:TEST_DATABASE_URL = & $readConnectionString "Dedicated Neon test database URL (name must end in _test)"
$env:DATABASE_MIGRATION_URL = & $readConnectionString "Direct (unpooled) URL for the dedicated test database"

# Applies the versioned schema only to TEST_DATABASE_URL.
npm run db:migrate

# Re-checks that the test database is distinct and empty, then marks it for tests.
npm run db:test:prepare

$env:RUN_POSTGRES_INTEGRATION_TESTS = "1"
npm test -- tests/database.integration.test.ts

Remove-Item Env:DATABASE_URL, Env:DATABASE_MIGRATION_URL, Env:TEST_DATABASE_URL, Env:RUN_POSTGRES_INTEGRATION_TESTS
```

Enter only development and dedicated test database URLs at the secure prompts. Do not use a production connection string. Use the pooled test URL for `TEST_DATABASE_URL` and its direct/unpooled URL for `DATABASE_MIGRATION_URL`. The preparation command refuses a non-Neon/non-test-named database, a database on the same endpoint as `DATABASE_URL`, or a database containing application rows. It then records an explicit test-only marker. The integration suite also requires that marker and cleans only fixture arrangements stored under `/private/test/`; keep this database dedicated to the tests.

Open [http://localhost:3000](http://localhost:3000). Students can search from the home page. Administrators can sign in at `/upload` to upload a seating PDF or manage the active arrangement.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production application |
| `npm run start` | Start the production server after building |
| `npm test` | Run the test suite |
| `npm run lint` | Run Next.js linting |
| `npm run db:migrate` | Manually apply pending versioned PostgreSQL migrations using `DATABASE_MIGRATION_URL` |
| `npm run generate:hash -- "<password>"` | Print a bcrypt hash for the supplied password |

## Configuration and data

| Variable | Description |
| --- | --- |
| `ADMIN_USERNAME` | Admin login name; defaults to `admin` |
| `ADMIN_PASSWORD_HASH` | Required bcrypt hash for the admin password |
| `SESSION_SECRET` | Optional dedicated HMAC key for signing admin session cookies; falls back to the server-only admin password hash |
| `DATABASE_URL` | Pooled PostgreSQL connection string used by the Next.js server |
| `DATABASE_URL_UNPOOLED` | Direct Neon connection for manual schema administration |
| `DATABASE_MIGRATION_URL` | Explicit PostgreSQL connection string used only by the manual migration command |
| `TEST_DATABASE_URL` | Dedicated PostgreSQL test database; used only when integration tests are explicitly enabled |
| `RUN_POSTGRES_INTEGRATION_TESTS` | Set to `1` to run the destructive, isolated PostgreSQL repository integration tests |
| `PDF_PARSER_URL` | Parser service base URL; on Vercel this is injected by the private service binding |
| `PDF_PARSER_SECRET` | Shared server-only bearer secret configured for both services |
| `PDF_STORAGE_ENABLED` | Set to `1` only after the private object bucket and server environment variables are verified |
| `AWS_ACCESS_KEY_ID` | Server-only Neon Object Storage access key |
| `AWS_SECRET_ACCESS_KEY` | Server-only Neon Object Storage secret key |
| `AWS_ENDPOINT_URL_S3` | Server-only branch-scoped Neon Object Storage S3 endpoint |
| `AWS_REGION` | Server-only Neon Object Storage region |

Seating records are stored in PostgreSQL. The schema's partial unique index enforces at most one active arrangement; student rows reference their arrangement and are deleted with it. The app uses Neon serverless HTTP queries and non-interactive transactions. Replacement and deletion serialize on a PostgreSQL transaction advisory lock, and the replacement transaction rolls back completely if any new record fails.

## Deployment note

The parser is a FastAPI service that runs the existing PyMuPDF extraction code. Vercel's current documentation lists Services as beta and available on all plans. In this repository's Services configuration, only the Next.js service has public ingress; it calls the parser over a private service binding and a shared secret. The binding itself grants network access, not authorization. The project's Services deployment and binding still need validation in an authenticated preview deployment. If Services are unavailable for the project, run the FastAPI parser as a separately hosted private service and configure the Next.js server with its HTTPS base URL and the same server-only bearer secret. Do not expose the parser to unauthenticated requests.

The PostgreSQL migration does not import or modify the existing SQLite database or local PDFs. Keep those files unchanged and make any data-retention/import decision separately. The `better-sqlite3` dependency remains installed pending that decision.

The app is configured to store PDFs in the `mecseater-pdfs` Neon Object Storage bucket, explicitly private. The server uses the S3 API with path-style addressing and never returns an object URL or storage key to the browser. Uploads remain disabled unless `PDF_STORAGE_ENABLED=1`. Before enabling uploads, provision the private bucket for the production branch with `neon deploy`, set the four `AWS_*` variables as server-side Vercel environment variables, and verify the parser service and credentials in a preview deployment. Never use public bucket access or `NEXT_PUBLIC_` storage variables.

The upload route registers a staged object, uploads PDF bytes privately, parses and validates the records, and only then switches the active PostgreSQL arrangement. Database replacement/deletion transactions place obsolete PDF keys in `pdf_cleanup_queue`; cleanup runs only after commit. If immediate cleanup fails, the durable queue preserves the work for retry. Configure a scheduled operational invocation of `npm run storage:cleanup` using server-only database and storage credentials. The cleanup command only deletes managed PDF keys recorded in that queue. A failed replacement leaves the previous active arrangement and its PDF untouched.

The parser receives PDF bytes directly from the Next.js server; no public PDF URL is used. Exam dates are validated using the `Asia/Kolkata` calendar date. Existing PDFs and SQLite data are not automatically imported.

The Vercel project must have the database, admin, parser, and private storage environment variables configured. Verify that the parser service binding is supported and available to this project, then verify the parser request and a synthetic upload in a preview deployment before enabling `PDF_STORAGE_ENABLED`. No existing local PDF or SQLite data is imported by this application.
