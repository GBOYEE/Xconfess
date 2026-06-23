# Local Demo Data Seed Guide

This guide explains how to populate your local XConfess environment with
realistic demo data for GrantFox milestone demos and contributor onboarding.

## Prerequisites

- PostgreSQL is running (via `compose.yaml` or your local install)
- Backend dependencies installed (`npm install` in `xconfess-backend/`)
- Database migrated (`npm run migration:run` or equivalent)

## Quick Start

```bash
cd xconfess-backend
npm run seed:demo
```

This runs `scripts/seed-demo.ts`, which idempotently creates:

| Entity     | Count | Description                                  |
|------------|-------|----------------------------------------------|
| Users      | 2     | 1 admin + 1 regular user                     |
| Anonymous  | 3     | 3 anonymous identities (seed-anon-0/1/2)     |
| Tags       | 5     | funny, serious, question, story, advice      |
| Confessions| 6     | Varied messages with gender + tag assignments|
| Reactions  | ~12   | Emoji reactions across anonymous users        |
| Comments   | ~9    | Sample comments on confessions               |
| Tips       | 3     | Sample tips on first 3 confessions           |

## Demo Credentials

| Role   | Username      | Password                   |
|--------|---------------|----------------------------|
| Admin  | `demo-admin`  | `demo-admin-password-2025` |
| User   | `demo-user`   | `demo-user-password-2025`  |

> These credentials are for **local development only**. Never commit real
> production credentials.

## Idempotency

The seed script is safe to re-run. It checks for existing records by:

- Users: `username` (unique constraint)
- Confessions: `message + anonymousUserId` combination
- Reactions: `confessionId + anonymousUserId + emoji` combination
- Comments: `confessionId + anonymousUserId + content` combination
- Tips: deterministic `txId` per run

If a record already exists, it is skipped. No duplicate key errors.

## Environment Variables

| Variable     | Default     | Purpose                    |
|--------------|-------------|----------------------------|
| `DB_HOST`    | `localhost` | PostgreSQL host            |
| `DB_PORT`    | `55432`     | PostgreSQL port            |
| `DB_USERNAME`| `postgres`  | PostgreSQL user            |
| `DB_PASSWORD`| `postgres`  | PostgreSQL password        |
| `DB_NAME`    | `xconfess`  | PostgreSQL database name   |

## Troubleshooting

### Connection refused
Ensure PostgreSQL is running and accessible at the configured host/port.
```bash
pg_isready -h localhost -p 55432
```

### relation does not exist
Run migrations first:
```bash
npm run migration:run
```

### Permission denied
Ensure the database user has CREATE/INSERT privileges on the target database.
