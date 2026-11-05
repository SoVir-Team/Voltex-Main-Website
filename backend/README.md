# Backend

The VOLTEX HTTP API, built with Express, TypeScript, Prisma, and PostgreSQL. It owns product and order persistence, enquiry inboxes, administrator authentication, and product image uploads. Its npm workspace name is `@voltex/api`.

## Source layout

```text
backend/
├── src/app.ts            # HTTP middleware and route composition
├── src/server.ts         # Listener, initial catalogue load, and shutdown
├── src/config.ts         # Validated environment configuration
├── src/db.ts             # Prisma client and PostgreSQL adapter
├── src/routes/           # Product, admin, and enquiry endpoints
├── src/services/         # Authentication, catalogue, and order logic
├── src/middleware/       # Authorization and upload handling
├── src/lib/              # Request validation and response helpers
├── src/scripts/          # Catalogue seed and admin provisioning commands
├── src/tests/            # Integration tests and test database setup
├── src/generated/prisma/ # Generated client; do not edit manually
├── prisma/               # Schema and committed database migrations
├── uploads/              # Default local runtime upload storage
└── .env.example          # Backend environment template
```

Pure pricing, phone validation, types, and shared constants come from `packages/shared/`.

## Develop

Follow [the root setup instructions](../README.md) to install dependencies and create environment files. Configure a running PostgreSQL database in `backend/.env`, then run from the repository root:

```powershell
cd D:\Voltex-Main-Site
npm run db:migrate
npm run admin:create
npm run dev:backend
```

The API defaults to [http://localhost:4000](http://localhost:4000). `GET /api/health` checks PostgreSQL connectivity. Use `npm run dev` to start both the API and frontend.

## Configuration

The full template is [.env.example](.env.example). Required settings include a PostgreSQL `DATABASE_URL` and a `JWT_SECRET` of at least 32 characters. Setup generates a secret only for a newly created backend environment file.

- `TEST_DATABASE_URL` must identify a separate disposable database for integration tests.
- `CORS_ORIGIN` lists allowed frontend origins, separated by commas.
- `UPLOAD_DIR` defaults to `./uploads`, relative to the backend process working directory. Use persistent storage in production.
- `TRUST_PROXY` must match the actual number of trusted proxy hops.
- `AUTO_SEED=true` loads the starter catalogue on an empty installation. Use explicit seeding and `AUTO_SEED=false` in production.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` are used by `npm run admin:create`. The command creates or resets that account; the password must contain at least 12 characters.

Never commit real environment files or credentials.

## API areas

| Path | Purpose |
| --- | --- |
| `GET /api/health` | Database-aware health check |
| `GET /api/products` | Active catalogue; optional `division` filter |
| `GET /api/products/:id` | Active product details |
| `POST /api/products/orders` | Customer order request and stock reservation |
| `POST /api/ideas` | Engineering idea submission |
| `POST /api/contact` | Contact message submission |
| `/api/admin/login`, `/api/admin/logout`, `/api/admin/me` | Administrator sessions |
| `/api/admin/summary`, `/api/admin/ideas`, `/api/admin/messages` | Protected administration and inboxes |
| `/api/products/admin/*` | Protected catalogue imports, product list, and orders |
| `POST /api/products`, `PUT/DELETE /api/products/:id`, `PATCH /api/products/:id/stock` | Protected product and inventory management |
| `GET /api/uploads/*` | Uploaded product images |

Admin sessions use a signed HttpOnly cookie. Protected state-changing routes also check request origins. Request validation and transaction logic live in the backend even when the frontend performs its own input checks.

## Database and tests

Run database commands from the repository root:

```text
npm run db:generate
npm run db:migrate
npm run db:seed
```

Use `db:migrate` during development to create or apply migrations. Commit schema changes and their migration files together. Production releases use `npm run db:deploy` to apply existing migrations.

Integration tests apply migrations and **truncate application tables**. Configure `TEST_DATABASE_URL` with a disposable database whose database name contains `test`. Never use the development or production database. The test database is validated before migrations run.

```text
npm run test:unit
npm run test:integration
```

Unit tests do not need PostgreSQL. Integration tests require the configured test database. CI provisions its own test database.

Build with `npm run build:backend` and start the compiled server with `npm run start:backend`. See [production operations](../deploy/README.md) for configuration, migrations, health checks, backups, and deployment responsibilities.
