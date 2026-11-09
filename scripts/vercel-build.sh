#!/usr/bin/env bash
# Vercel build: apply database migrations before building, so new code never
# runs against an old schema.
#
# Previews share the production database for now (one Supabase project on the
# free plan), so preview builds migrate it too. Keep migrations additive
# (new tables/columns) until previews get their own database.
set -euo pipefail
if [ -n "${VERCEL_ENV:-}" ] && [ "${VERCEL_ENV}" != "development" ]; then
  node scripts/migrate.mjs
fi
npx next build
