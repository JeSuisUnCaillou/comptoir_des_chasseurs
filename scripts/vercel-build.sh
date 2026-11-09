#!/usr/bin/env bash
# Vercel build: apply database migrations before building production,
# so the new code never runs against an old schema.
set -euo pipefail
if [ "${VERCEL_ENV:-}" = "production" ]; then
  node scripts/migrate.mjs
fi
npx next build
