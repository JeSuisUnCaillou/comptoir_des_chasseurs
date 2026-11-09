-- Grille tarifaire de l'app actuelle (relevée le 09/11/2026). Les stocks
-- partent de zéro : ils seront repris lors de la migration des données.
INSERT INTO "settings" ("key", "value") VALUES ('prix_forgeron_cuir', 6)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "products" ("name", "category", "unit", "buy_price", "sell_price", "hides_per_batch", "leather_per_batch") VALUES
  ('Biche', 'peau', 'peau', 2, 3, 4, 2),
  ('Chevreuil', 'peau', 'peau', 2, 3, 4, 2),
  ('Chèvre', 'peau', 'peau', 1, 2, 3, 1),
  ('Lion de Montagne', 'peau', 'peau', 16, 24, 1, 4),
  ('Loup', 'peau', 'peau', 2, 3, 2, 1),
  ('Loups des Glaces', 'peau', 'peau', 2, 3, 2, 1),
  ('Ours', 'peau', 'peau', 3, 5, 4, 4),
  ('Ours des neiges', 'peau', 'peau', 4, 6, 4, 4),
  ('Ours troglodyte', 'peau', 'peau', 4, 6, 4, 4),
  ('Renard', 'peau', 'peau', 2, 3, 2, 1),
  ('Renard des neiges', 'peau', 'peau', 2, 3, 2, 1),
  ('Smilodon des neiges', 'peau', 'peau', 4, 6, 4, 4),
  ('Vache', 'peau', 'peau', 2, 3, 6, 3)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "products" ("name", "category", "unit", "buy_price", "sell_price") VALUES
  ('Cuir', 'cuir', 'cuir', 4, 6)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "products" ("name", "category", "unit", "buy_price", "buy_qty", "sell_price", "sell_qty", "bulk_min", "bulk_price", "bulk_qty") VALUES
  ('Venaison', 'viande', 'pièce', 1, 1, 3, 1, 200, 2, 1),
  ('Viande d''horqueur', 'viande', 'pièce', 1, 1, 3, 1, 200, 2, 1),
  ('Viande de chèvre', 'viande', 'pièce', 1, 2, 1, 1, NULL, NULL, 1)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "products" ("name", "category", "unit", "buy_price", "buy_qty", "sell_price", "sell_qty") VALUES
  ('Arme débutant', 'ressource', 'pièce', 5, 1, 10, 1),
  ('Cap de Cuir', 'ressource', 'pièce', 5, 1, 10, 1),
  ('Champignons, fleurs, œufs de Chorus (sauf rares)', 'ressource', 'pièce', 1, 4, 1, 2),
  ('Flèches d''acier', 'ressource', 'flèche', 1, 11, 15, 80),
  ('Kit débutant', 'ressource', 'lot', 15, 1, 30, 1),
  ('Œufs en tout genre (sauf Chorus)', 'ressource', 'pièce', 1, 1, 3, 1),
  ('Patte de vasard', 'ressource', 'pièce', 1, 6, 1, 3),
  ('Petits poissons (ex. carpe de Hist)', 'ressource', 'pièce', 2, 1, 4, 1),
  ('Produits alchimiques : animaux à danger faible', 'ressource', 'pièce', 1, 1, 2, 1),
  ('Produits alchimiques : animaux à danger modéré', 'ressource', 'pièce', 1, 1, 3, 1),
  ('Produits alchimiques : animaux à danger élevé', 'ressource', 'pièce', 2, 1, 5, 1)
ON CONFLICT ("name") DO NOTHING;
