## Simple Crypto API

NestJS + PostgreSQL service that implements a minimal crypto-wallet style ledger:

- **User registration & login** with stateless JWT auth.
- **Encrypted JWT payload**: user data is stored in an encrypted claim (`enc`) using AES-256-GCM with a key derived from `JWT_SECRET`.
- **Ledger-based balance**: there is no mutable balance column; balances are derived from the `Transaction` table (CREDIT − DEBIT).
- **Topup & transfer** with row-level locking (`SELECT ... FOR UPDATE`) to avoid race conditions on balance updates.
- **Reporting**:
  - `GET /top_transactions_per_user` shows the largest incoming/outgoing transfers for the current user.
  - `GET /top_users` uses the summary table `UserTransferStats` (column `totalOutbound`) as an outbound-transfer leaderboard.

Main stack:

- NestJS 11.1.9
- Prisma ORM 7 + PostgreSQL 18.1 (adapter `@prisma/adapter-pg`)
- ULID as primary key (`String @id @db.VarChar(26)`)
- BigInt for monetary values (`BigInt @db.BigInt`)

---

## Environment variables

Example file: `.env.example`.

- **HTTP & DB**
  - `PORT` – defaults to `3000`.
  - `DB_HOST` – defaults to `localhost`.
  - `DB_PORT` – defaults to `5432`.
  - `DB_NAME` – **required**, PostgreSQL database name.
  - `DB_USER` – **required**, PostgreSQL user.
  - `DB_PASS` – **required**, PostgreSQL password.
  - `DB_SSL_MODE` – `false` or a PostgreSQL SSL mode (for example `require`).

- **JWT**
  - `JWT_SECRET` – **required**, strong secret used for JWT signing and AES-256-GCM key derivation.
  - `JWT_EXPIRES_IN` – expiry in **milliseconds** (for example `3600000` = 1 hour).

> Note: this service builds `DATABASE_URL` from `DB_*` variables via the `buildDatabaseUrlFromEnv()` helper.

---

## Setup

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # then edit .env and fill DB_NAME, DB_USER, DB_PASS, JWT_SECRET, JWT_EXPIRES_IN
   ```

3. **Create the PostgreSQL database**

   Create a database named `DB_NAME`, with credentials matching `DB_USER` and `DB_PASS`.

4. **Apply Prisma migrations**

   From the project root (`simple-crypto-api`):

   ```bash
   bunx prisma migrate deploy
   ```

   Ensure `prisma/migrations` exists and is up to date.

---

## Run service

Run these commands from this project root.

```bash
# development (watch mode)
bun start:dev

# production build
bun run build

# production run (uses the same env variables as dev/prod)
bun start:prod
```

The service listens on `PORT` (env) or `3000` by default.

---

## Testing

Scripts from `package.json` can be run with Bun:

```bash
# unit tests (Jest, rootDir=src)
bun run test

# e2e tests
bun test:e2e

# coverage
bun test:cov
```

> If a shorthand like `bun <script>` does not work in your Bun version, fall back to `bun run <script>`.

### E2E notes

- E2E tests (`test/app.e2e-spec.ts`) boot the full `AppModule` and use the same PostgreSQL database defined by `DB_*` env vars.
- At minimum, set the following before running e2e tests:
  - `DB_NAME`, `DB_USER`, `DB_PASS`
  - `JWT_SECRET` (tests provide a fallback if not set, but for real runs you should configure it explicitly)
  - `JWT_EXPIRES_IN`
- Before each scenario, the helper `resetDatabase` truncates:
  - `User`
  - `Transaction`
  - `UserTransferStats`

E2E scenarios cover, among others:

- Full happy path: register → login → topup → transfer → balance → `GET /top_transactions_per_user` → `GET /top_users`.
- Duplicate username (409), invalid amount, insufficient balance.
- JWT guard behaviour (401 when no token is provided).
- `Authorization` header supporting both `Bearer <token>` and raw `<token>`.
- Reporting payload and ordering for `top_transactions_per_user` and `top_users`.

---

## API overview

High-level endpoints (all at the root, no version prefix):

- `POST /user` – register a new user and return a JWT.
- `POST /login` – login by username and return a JWT.
- `POST /topup` – **requires JWT**, add balance via a CREDIT transaction.
- `GET /balance` – **requires JWT**, read logical balance from the ledger (CREDIT − DEBIT).
- `POST /transfer` – **requires JWT**, transfer balance between users with row-level locking and DEBIT/CREDIT ledger entries.
- `GET /top_transactions_per_user` – **requires JWT**, list the largest incoming/outgoing transfers for the current user.
- `GET /top_users` – **requires JWT**, global leaderboard by `UserTransferStats.totalOutbound`.

---

## Deployment notes

1. **Build & runtime**

   ```bash
   bun install
   bun run build
   bun start:prod
   ```

2. **Environment in production**

   - Set all `DB_*` variables to point at the production PostgreSQL instance.
   - Set a long, hard-to-guess `JWT_SECRET`.
   - Set `JWT_EXPIRES_IN` according to your requirements (in ms).
   - Consider `DB_SSL_MODE=require` if the DB is accessed over a public network or via a managed service.

3. **Database migrations**

   Run before starting the service for the first time (and whenever the schema changes):

   ```bash
   bunx prisma migrate deploy
   ```

4. **Security**

   - Sensitive data is not exposed as plain JWT claims; user info lives inside the encrypted `enc` claim.
   - The service is fully stateless with respect to JWT (no tokens stored in the DB); revocation is handled via expiry and secret rotation.
   - Keep `.env` / secrets out of version control and manage them via your platform's secret management.
