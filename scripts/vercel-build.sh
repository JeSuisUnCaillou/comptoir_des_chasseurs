#!/usr/bin/env bash
# Vercel build: apply database migrations before building, so new code never
# runs against an old schema.
#
# Production migrates the production database; previews migrate their own
# PREVIEW_* database (see lib/db/url.mjs) and never touch production.
set -euo pipefail
if [ -n "${VERCEL_ENV:-}" ] && [ "${VERCEL_ENV}" != "development" ]; then
  node scripts/migrate.mjs
  node scripts/seed-preview.mjs
fi
npx next build
