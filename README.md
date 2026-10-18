# Mecseater

Mecseater lets an administrator upload an exam seating-arrangement PDF and lets students search the extracted seating records by name or roll number.

## Requirements

- Node.js 18.17 or later and npm
- Python 3 with PyMuPDF (`fitz`); on Windows, the `py -3` launcher must be available

Install the Python PDF parser dependency:

```powershell
py -3 -m pip install PyMuPDF
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

Start the development server:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Students can search from the home page. Administrators can sign in at `/upload` to upload a seating PDF or manage the active arrangement.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production application |
| `npm run start` | Start the production server after building |
| `npm test` | Run the test suite |
| `npm run lint` | Run Next.js linting |
| `npm run generate:hash -- "<password>"` | Print a bcrypt hash for the supplied password |

## Configuration and data

| Variable | Description |
| --- | --- |
| `ADMIN_USERNAME` | Admin login name; defaults to `admin` |
| `ADMIN_PASSWORD_HASH` | Required bcrypt hash for the admin password |
| `DATABASE_PATH` | SQLite database file; defaults to `data/mecseater.sqlite` |

Seating records are stored in SQLite. Uploaded PDFs and the database are kept under `data/` by default. These are local files and are intentionally excluded from Git; back them up if you need to preserve them.

## Deployment note

The application currently depends on a local SQLite database, local PDF storage, and a Python subprocess for PDF parsing. A serverless deployment such as Vercel does not provide durable local filesystem storage and does not meet the parser's Windows `py -3` assumption. Before deploying there, replace local persistence with a hosted database and object storage, and adapt or host the PDF parser in a compatible runtime.
