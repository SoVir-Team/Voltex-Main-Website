#!/usr/bin/env bash
set -euo pipefail
# Run in a dedicated server clone; never use a developer's working directory.
sha="${1:?Pass the validated production commit SHA}"
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 1
cd /srv/voltex
exec 9>/srv/voltex-deploy.lock
flock -x 9
test -f deploy/.env
test -z "$(git status --porcelain --untracked-files=no)"
git fetch origin production
if [[ "$(git rev-parse FETCH_HEAD)" != "$sha" ]]; then
  echo 'Production has advanced; skipping this older release.'
  exit 0
fi
git checkout --detach "$sha"
export RELEASE_SHA="$sha"
compose=(docker compose --env-file deploy/.env -f deploy/compose.yml)
"${compose[@]}" config --quiet
"${compose[@]}" build --pull
"${compose[@]}" run --rm --no-deps api npm run db:deploy
"${compose[@]}" up -d --wait --wait-timeout 180
echo "Deployed $sha"
