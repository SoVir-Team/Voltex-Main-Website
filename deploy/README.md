# Production operations

For the Docker-based server setup and automatic deployment from `production`, follow [the server deployment guide](SERVER.md). The manual application operations below are also available. Provision PostgreSQL, TLS, backups, and the server separately.

## Environment

Use Node.js 24 and install from the root lockfile with `npm ci`. Build with development dependencies available; TypeScript, Prisma generation, and the frontend build need them.

Configure the backend through environment variables or `backend/.env`:

| Setting | Production use |
| --- | --- |
| `NODE_ENV` | `production`, enabling secure session cookies |
| `DATABASE_URL` | Production PostgreSQL connection using deployment-managed credentials |
| `JWT_SECRET` | Random secret of at least 32 characters, kept in your secret store |
| `CORS_ORIGIN` | Allowed public site origins, comma-separated |
| `SITE_URL` | Public HTTPS site URL |
| `PORT` | Internal API port, normally `4000` |
| `UPLOAD_DIR` | Absolute path to persistent, writable upload storage |
| `TRUST_PROXY` | Number of trusted proxy hops; set to match the actual network topology |
| `AUTO_SEED` | `false`; import starter content explicitly when wanted |

Set `API_INTERNAL_URL` for the frontend to the backend's reachable internal address and `NEXT_PUBLIC_SITE_URL` to the public HTTPS site URL. Set frontend values before building; public values are included in build output. Never place database credentials, admin passwords, or signing secrets in `NEXT_PUBLIC_*` variables.

Supply `ADMIN_EMAIL` and `ADMIN_PASSWORD` when creating or resetting an administrator. The password must contain at least 12 characters. Treat `npm run admin:create` as a credential change: it resets an existing matching account's password.

## Release sequence

Run from the repository root with production configuration already supplied:

```text
npm ci
npm run db:generate
npm run build
npm run db:deploy
```

Back up the database before schema changes and review migrations before applying them. Apply migrations once per release using a controlled release process, rather than independently from every application replica. `db:deploy` applies committed migrations; use `db:migrate` only during development.

For the first installation, run `npm run admin:create` with the intended administrator credentials. Run `npm run db:seed` only if the starter catalogue is wanted. Keep `AUTO_SEED=false` for routine production startup.

Start the built applications under your process supervisor:

```text
npm run start:backend
npm run start:frontend
```

These are separate long-running processes. `npm start` runs both together for a basic combined launch. `start:backend` runs the compiled API and loads `backend/.env` when present; `start:frontend` runs the prepared standalone server and loads `frontend/.env.local` when present. Root npm commands select the correct workspace working directory. Supply production environment files or deployment-managed environment variables before starting.

Configure the reverse proxy to serve the frontend and forward `/api` to the backend, or let Next.js use its configured API rewrite. Use the same public origin for browser requests and session cookies. Expose only the intended public entry point; configure proxy trust to match your own trusted infrastructure.

## Standalone frontend artifact

`npm run build` and `npm run build:frontend` prepare `frontend/.next/standalone/` for deployment. After Next.js builds, the repository's preparation helper copies `frontend/public/` and `frontend/.next/static/` into the artifact automatically. No manual asset-copy step is needed after a successful normal build.

Deploy the complete `frontend/.next/standalone/` directory, preserving its contents and relative paths, including traced workspace dependencies. The server entry point inside the deployed artifact is `frontend/server.js`. From the artifact root, start it with:

```text
node frontend/server.js
```

Set the intended `PORT`, `HOSTNAME`, and frontend runtime environment in your process supervisor. When running from the complete repository, `npm run start:frontend` selects the generated server automatically. Keep frontend values configured before building, and validate artifact portability in the target environment.

## Health, persistence, and recovery

- `GET /api/health` returns HTTP 200 with `{ "status": "ok" }` when PostgreSQL is reachable, and HTTP 503 when it is unavailable. Monitor it through the deployed routing path.
- Capture backend request logs from standard output and configure centralized retention and alerting in the hosting environment.
- Keep `UPLOAD_DIR` on persistent storage. Uploaded product images must survive application releases; multiple backend instances need shared storage or an appropriate external storage design.
- Back up PostgreSQL and uploaded files, and verify restoration together. Reverting application code does not undo database migrations; assess schema compatibility before rollback.
- Shut down with `SIGTERM` or `SIGINT` so the API can close its listener and database connections. Its shutdown timeout is ten seconds.
- API rate limits use in-process storage. Multiple backend instances need a shared rate-limit store or protection at the gateway if limits must apply across the deployment.

Use a separate disposable test database for automated tests. Integration tests truncate application tables and must never use the production database. Production deployment is enabled separately as described in the server guide.
