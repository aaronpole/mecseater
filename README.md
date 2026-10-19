<div align="center">

# MECSeater

**Fast, accessible, and minimalist examination seating directory.**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-black?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-black?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-black?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Serverless-black?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Python](https://img.shields.io/badge/Python-FastAPI_Parser-black?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)

[Features](#key-features) • [Design System](#monochrome-design-system) • [Architecture](#architecture) • [Getting Started](#getting-started) • [Configuration](#configuration) • [Commands](#available-commands)

</div>

---

## Overview

**MECSeater** streamlines exam room seating lookups for students and administrators at Govt. Model Engineering College.

- **Students**: Search by roll number or student name to instantly locate assigned examination halls, rooms, and seat numbers.
- **Administrators**: Upload official exam seating PDFs via an authenticated management console that automatically extracts, validates, and atomically switches the active seating arrangement.

---

## Key Features

* **Instant Search with High Glanceability**:
  * Emphasized, prominent **Room Number** badges engineered for rapid scanning in crowded corridors.
  * Clear pairing of student name, roll number, and desk/seat allocation.
  * Fluid keyboard navigation and instant input clear controls.
* **Monochrome Minimalist Interface**:
  * High-contrast black-and-white theme (`#090909` background, `#111111` surfaces, crisp white typography).
  * Helvetica typography stack (`Helvetica, Arial, sans-serif`) with zero third-party font bloat.
  * Restrained borders, no garish gradients, and strictly no decorative clutter.
* **Accessible & Motion-Conscious**:
  * High-contrast ratios exceeding WCAG AAA standards.
  * Visible keyboard focus rings (`:focus-visible`).
  * Built-in support for `prefers-reduced-motion` to disable animations for sensitive users.
* **Resilient Responsive Layout**:
  * Mobile-first responsive design engineered for seamless display from narrow mobile screens (320px, 375px) to ultra-wide displays.
  * Touch-optimized targets (minimum 44px height for inputs and buttons).
* **Automated PDF Parsing Microservice**:
  * Dedicated FastAPI microservice powered by PyMuPDF for reliable tabular PDF data extraction.
* **Atomic Database Transactions**:
  * Managed via Neon PostgreSQL with transaction advisory locks, ensuring zero downtime and atomic seating schedule replacement with automatic rollback.
* **Secure Private Storage**:
  * S3-compatible private object storage for seating PDFs with durable cleanup queues and automatic cleanup of obsolete files.

---

## Monochrome Design System

| Token | Value | Role |
| --- | --- | --- |
| `--color-background` | `#090909` | Deep near-black background |
| `--color-surface` | `#111111` | Primary cards & search console surface |
| `--color-surface-elevated` | `#191919` | Elevated badges, metric tiles & room blocks |
| `--color-primary` | `#FFFFFF` | Primary actions, headings & highlighted data |
| `--color-text-secondary` | `#A3A3A3` | Metadata, roll numbers & descriptions |
| `--color-muted` | `#737373` | Form placeholders, subtle labels & timestamps |
| `--color-border` | `#262626` | Restrained 1px component borders |
| `--font-sans` | `Helvetica, Arial, sans-serif` | Clean Swiss modernist typography stack |

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Next.js 15 Client                    │
│      Student Search (/)  •  Admin Dashboard (/upload)  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / API Routes
┌───────────────────────────▼────────────────────────────┐
│                  Next.js App Server                    │
│   • Auth & Session Cookies (HMAC / bcrypt)             │
│   • Search API (/api/search)                           │
│   • Upload & Management API (/api/upload, /api/arrange)│
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
              │ Internal Bearer Auth      │ Pooled Connection (pg)
              ▼                           ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  FastAPI Parser Service  │    │     Neon PostgreSQL      │
│  (PyMuPDF Table Parser)  │    │   • Active Arrangement   │
└─────────────┬────────────┘    │   • Student Allocations  │
              │                 │   • PDF Cleanup Queue    │
              │ S3 API          └──────────────────────────┘
              ▼
┌──────────────────────────┐
│ Neon Private S3 Storage  │
│ (mecseater-pdfs bucket)  │
└──────────────────────────┘
```

---

## Getting Started

### Prerequisites

* **Node.js** 18.17+ and **npm**
* **Python** 3.12+ (for the PDF parser microservice)
* **PostgreSQL** database (e.g. [Neon](https://neon.tech))

---

### 1. Clone & Install Dependencies

```powershell
# Clone the repository
git clone https://github.com/aaronpole/mecseater.git
cd mecseater

# Install Node.js dependencies
npm ci

# Install Python parser dependencies
py -3 -m pip install -r services/pdf-parser/requirements-test.txt
```

---

### 2. Environment Configuration

Copy the example environment configuration:

```powershell
Copy-Item .env.example .env.local
```

Generate a secure admin password bcrypt hash without writing it to shell history:

```powershell
$password = Read-Host "Admin password" -AsSecureString
$plainPassword = [System.Net.NetworkCredential]::new("", $password).Password
npm run generate:hash -- "$plainPassword"
Remove-Variable plainPassword, password
```

Copy the generated hash into `ADMIN_PASSWORD_HASH` inside `.env.local`.

---

### 3. Database Migration

Set your unpooled PostgreSQL migration URL in your environment, then run the database migration:

```powershell
$env:DATABASE_MIGRATION_URL = "postgresql://user:pass@ep-example.neon.tech/neondb?sslmode=require"
npm run db:migrate
```

---

### 4. Run the Development Servers

In your first terminal, start the Python PDF parser service:

```powershell
$env:PDF_PARSER_SECRET = "your-shared-secret-here"
py -3 -m uvicorn main:app --app-dir services/pdf-parser --host 127.0.0.1 --port 8000
```

In your second terminal, start the Next.js development server:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the student search interface, or navigate to [http://localhost:3000/upload](http://localhost:3000/upload) to access the admin portal.

---

## Configuration Reference

| Environment Variable | Description |
| --- | --- |
| `ADMIN_USERNAME` | Administrator username (defaults to `admin`) |
| `ADMIN_PASSWORD_HASH` | Required bcrypt hash for admin authentication |
| `SESSION_SECRET` | Dedicated secret key for signing session cookies |
| `DATABASE_URL` | Pooled PostgreSQL connection string for application runtime |
| `DATABASE_URL_UNPOOLED` | Direct PostgreSQL connection for manual schema administration |
| `DATABASE_MIGRATION_URL` | Explicit connection string used exclusively by `npm run db:migrate` |
| `TEST_DATABASE_URL` | Dedicated PostgreSQL test database URL (name must end with `_test`) |
| `RUN_POSTGRES_INTEGRATION_TESTS` | Set to `1` to run isolated PostgreSQL integration test suites |
| `PDF_PARSER_URL` | Base URL for the FastAPI PDF parsing microservice (default: `http://127.0.0.1:8000`) |
| `PDF_PARSER_SECRET` | Shared bearer token for server-to-parser authentication |
| `PDF_STORAGE_ENABLED` | Set to `1` when S3 object storage is provisioned and enabled |
| `AWS_ACCESS_KEY_ID` | Server-only Neon Object Storage access key |
| `AWS_SECRET_ACCESS_KEY` | Server-only Neon Object Storage secret key |
| `AWS_ENDPOINT_URL_S3` | Server-only branch-scoped Neon S3 endpoint URL |
| `AWS_REGION` | Neon Object Storage region |

---

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server with Turbopack |
| `npm run build` | Compile and build the production Next.js application |
| `npm run start` | Run the built production application server |
| `npm run lint` | Execute ESLint checks across the codebase |
| `npm test` | Run Vitest unit and integration test suites |
| `npm run db:migrate` | Apply pending versioned PostgreSQL migrations |
| `npm run db:test:prepare`| Validate and prepare an isolated test database for integration testing |
| `npm run storage:cleanup`| Process pending object storage deletions from `pdf_cleanup_queue` |
| `npm run generate:hash` | Helper utility to generate bcrypt password hashes |

---

## Testing

MECSeater includes comprehensive unit and integration tests covering PDF parsing, route protection, storage cleanup queues, and response parsing:

```powershell
npm test
```

To run the isolated PostgreSQL repository integration tests against a dedicated test database:

```powershell
$env:RUN_POSTGRES_INTEGRATION_TESTS = "1"
$env:TEST_DATABASE_URL = "postgresql://user:pass@ep-test.neon.tech/neondb_test?sslmode=require"
npm test -- tests/database.integration.test.ts
```

---

## Deployment

* **Frontend & API**: Deployed on [Vercel](https://vercel.com/) utilizing Next.js App Router and serverless route handlers.
* **Database**: Managed on [Neon](https://neon.tech/) with pooled connections and automated schema migrations.
* **PDF Parser**: Runs as a private service microservice connected via internal service bindings with shared secret verification.
* **Object Storage**: Private S3-compatible Neon Object Storage bucket for seating PDFs.

---

## License

This project is open-source and available under the terms of the project repository.
