# Production deployment

Use `main` for local development. Promote tested changes with a pull request from `main` to `production`. Both branches run CI; only production deploys after validation. Configure branch protection to require `Validate application` on both branches in GitHub Settings.

## One-time setup

1. Provision a Linux server with Docker Engine, Compose v2 supporting `up --wait`, Git, Bash, and `flock`. Use a dedicated deployment account with Docker access. Clone this repository to `/srv/voltex`, owned by that account. Create `/srv/voltex-deploy.lock` owned by it. Private repositories need a read-only GitHub deploy key on the server.
2. Copy `deploy/.env.example` to `deploy/.env`; run `chmod 600 deploy/.env` and set real values. Provision PostgreSQL separately, reachable from Docker (localhost means the container). Configure database and upload backups before releases.
3. Configure DNS and a host HTTPS reverse proxy forwarding all requests to `127.0.0.1:3000`. Preserve Host and set trusted X-Forwarded-For and X-Forwarded-Proto headers. The frontend forwards `/api` to the internal API container. Keep port 3000 restricted to the host proxy. Set request-body limits for image uploads.
4. Create a GitHub environment named `production`, restricted to that branch. Add secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_KNOWN_HOSTS`. Authorize the matching public key on the server. Obtain the server's SSH known-hosts line through an independently verified channel. See [GitHub environment setup](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
5. Set repository Actions variable `DEPLOY_ENABLED=true` after setup. Until then deployment is skipped. Merge to production or manually dispatch CI on production to release.

The script uses only the dedicated server clone, serializes releases, verifies the validated commit is still production's tip, builds images tagged by commit, applies migrations, and waits for healthy services. Uploads persist in `voltex_uploads`. Compose uses [health-based startup ordering](https://docs.docker.com/compose/how-tos/startup-order/).

For first-time admin creation, export ADMIN_EMAIL and ADMIN_PASSWORD in the server shell, then run from `/srv/voltex`:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yml run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD api npm run admin:create
```

Unset credentials afterward. This resets the password if the administrator already exists. Production never seeds automatically.

## Recovery and operations

Inspect Actions logs and `docker compose --env-file deploy/.env -f deploy/compose.yml logs --tail=100`. A failed deployment fails the workflow. Database rollback is not automatic. Back up before migrations and use backward-compatible schema changes because the old application may still be serving during migration. To roll back code, revert on main and promote the revert to production after checking schema compatibility. Keep disk space available for Docker builds and periodically remove unused images. Never remove the upload volume (`docker compose down -v` deletes it). This single-server setup can have brief downtime during replacement; it does not provision infrastructure or TLS.
