#!/usr/bin/env bash
# Remove Vercel deployments created AFTER the current production deployment.
# Requires: npx vercel, VERCEL_TOKEN (or vercel login), team scope access.
#
# Usage:
#   VERCEL_TOKEN=... ./scripts/vercel-prune-newer-deployments.sh
#   VERCEL_TOKEN=... TEAM_SLUG=precious-projects-32fd577b PROJECT=pro-community ./scripts/vercel-prune-newer-deployments.sh

set -euo pipefail

TEAM_SLUG="${TEAM_SLUG:-precious-projects-32fd577b}"
PROJECT="${PROJECT:-pro-community}"
SCOPE=(--scope "$TEAM_SLUG")

echo "Listing production deployment for $PROJECT on $TEAM_SLUG..."
PROD_JSON="$(npx vercel list "$PROJECT" "${SCOPE[@]}" --status READY --format json 2>/dev/null | head -c 500000)"
# Pick newest production (target=production) as anchor
ANCHOR_CREATED="$(node -e "
  const rows = JSON.parse(process.argv[1]);
  const prod = rows
    .filter((d) => d.target === 'production' || d.meta?.githubCommitRef === 'master')
  .sort((a, b) => new Date(b.created) - new Date(a.created))[0];
  if (!prod) { console.error('No production deployment found'); process.exit(1); }
  console.log(JSON.stringify({ id: prod.uid || prod.id, url: prod.url, created: prod.created, meta: prod.meta }));
")" "$PROD_JSON"

echo "Anchor (keep): $ANCHOR_CREATED"
ANCHOR_MS="$(node -e "console.log(Date.parse(JSON.parse(process.argv[1]).created))" "$ANCHOR_CREATED")"

echo "Deployments to remove (created after anchor)..."
npx vercel list "$PROJECT" "${SCOPE[@]}" --format json | node -e "
  const anchor = $ANCHOR_MS;
  const rows = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  for (const d of rows) {
    const t = Date.parse(d.created);
    if (t > anchor) console.log(d.uid || d.url);
  }
" | while read -r id; do
  [[ -z "$id" ]] && continue
  echo "Removing $id..."
  npx vercel remove "$id" -y "${SCOPE[@]}" || true
done

echo "Done."