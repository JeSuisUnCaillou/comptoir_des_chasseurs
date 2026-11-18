-- members.role, products.category and products.citizen_buy_price leave the
-- schema, but stay in the database while the code in production still selects
-- them; a later migration drops them with the product_category type and the
-- products_fill_category trigger (issue #187). Only the check reading
-- members.role goes now: new accounts leave it at its default, 'employe'.
ALTER TABLE "members" DROP CONSTRAINT IF EXISTS "members_super_admin_gerant";
