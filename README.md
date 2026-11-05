# VOLTEX

VOLTEX's public website, product catalogue, order requests, and administration portal. The repository uses npm workspaces to keep the frontend, backend, and shared business rules together while giving each application its own source and configuration.

## Repository layout

```text
Voltex-Main-Site/
├── frontend/             # Next.js website, admin interface, and public assets
├── backend/              # Express API, Prisma schema/migrations, and uploads
├── packages/shared/      # Shared TypeScript contracts, pricing, and validation
├── scripts/              # Repository setup helpers
├── docs/                 # Architecture documentation
├── deploy/               # Production operations guide
├── .github/workflows/    # Automated quality checks
├── package.json          # Workspace orchestration and developer commands
└── package-lock.json     # Dependency lockfile for the whole repository
```

Workspace package names remain `@voltex/web`, `@voltex/api`, and `@voltex/shared`. Install dependencies from the repository root; individual application lockfiles are unnecessary.

## Local setup

Use Node.js 24, as specified in `.nvmrc`, npm, and a running PostgreSQL server. Node.js 22.12 or newer in the 22.x line is also supported. Create a development database and a separate disposable test database, for example `voltex` and `voltex_test`, with credentials that match your configuration.

In PowerShell:

```powershell
cd D:\Voltex-Main-Site
npm install
npm run setup
```

Setup creates `backend/.env` and `frontend/.env.local` from their examples when missing, generates a JWT secret for a new backend environment file, generates the Prisma client, and builds the shared package. Existing environment files are preserved.

Edit `backend/.env` to set `DATABASE_URL`, `TEST_DATABASE_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Use an admin password of at least 12 characters. Check `frontend/.env.local` if your API or site uses a different address.

Initialize the development database and create the admin login:

```powershell
npm run db:migrate
npm run admin:create
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API listens on port 4000; [http://localhost:4000/api/health](http://localhost:4000/api/health) checks database connectivity. Sign in at `/admin/login` with the configured admin credentials. Development startup loads the starter catalogue when `AUTO_SEED=true`; `npm run db:seed` also loads it explicitly.

Press `Ctrl+C` to stop the development servers.

## Commands

Run these commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build shared code and run both applications with file watching |
| `npm run dev:frontend` | Run the frontend on port 3000 |
| `npm run dev:backend` | Run the backend on port 4000 |
| `npm run build` | Build shared code, backend, and frontend for production |
| `npm run build:frontend` | Build shared code and prepare the frontend standalone artifact with assets |
| `npm run build:backend` | Build shared code and the backend |
| `npm run start` | Start both previously built applications |
| `npm run start:frontend` | Start the prepared frontend standalone server |
| `npm run start:backend` | Start the built backend |
| `npm run db:generate` | Regenerate the Prisma client after schema changes |
| `npm run db:migrate` | Create/apply development migrations |
| `npm run db:deploy` | Apply committed migrations to the configured database |
| `npm run db:seed` | Import the starter catalogue |
| `npm run admin:create` | Create or reset the configured admin account |
| `npm run lint` | Run application lint checks |
| `npm run typecheck` | Check TypeScript across workspaces |
| `npm run test:unit` | Run tests that do not require PostgreSQL |
| `npm run test:integration` | Run backend integration tests against a disposable test database |
| `npm test` | Run shared and backend tests |
| `npm run check` | Run lint, type checks, tests, and production builds |

## Testing

Backend integration tests apply migrations and **truncate application tables** in the selected database. Set `TEST_DATABASE_URL` to a dedicated disposable PostgreSQL database whose database name contains `test`; never point it at development or production data. A test URL is validated before migrations run. CI provisions its own PostgreSQL test database.

```powershell
npm run test:unit
npm run test:integration
npm run check
```

Unit tests can run without a database. Integration tests and the full check require the test database to be reachable.

## Configuration and production

Develop and test on `main`. Promote changes with a pull request into `production` when ready to host them. Both branches run CI; only `production` can trigger server deployment. Follow [server and CI/CD setup](deploy/SERVER.md) to configure hosting and GitHub secrets.

The committed environment templates document available settings:

- [Backend configuration](backend/.env.example): database, authentication, origins, uploads, and API settings.
- [Frontend configuration](frontend/.env.example): internal API address and public site URL.

Keep actual environment files and credentials out of version control. Build and run instructions, persistent storage, health checks, and release responsibilities are covered in [the production guide](deploy/README.md). See [architecture](docs/architecture.md), [frontend](frontend/README.md), and [backend](backend/README.md) for ownership and implementation details.
