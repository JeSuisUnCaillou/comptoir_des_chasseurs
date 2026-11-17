-- Monday 16 November 2026 at midnight in Keizaal's time zone (Europe/Paris) is
-- each shop's first end of the week, declared by its owner (the super admin
-- when they belong to it, else its first gérant). Only for a shop without one.
INSERT INTO "week_ends" ("shop_id", "member_id", "declared_at")
SELECT DISTINCT ON (s."id") s."id", sm."member_id", '2026-11-16 00:00:00 Europe/Paris'::timestamptz
FROM "shops" s
JOIN "shop_members" sm ON sm."shop_id" = s."id" AND sm."role" = 'gerant'
JOIN "members" m ON m."id" = sm."member_id"
WHERE NOT EXISTS (SELECT 1 FROM "week_ends" w WHERE w."shop_id" = s."id")
ORDER BY s."id", m."super_admin" DESC, m."id";
