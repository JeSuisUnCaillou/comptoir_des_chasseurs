-- Treasury adjustments imported from the old app become cash movements: same
-- amount, same sign for the till, now shown as such in the register.
-- The statement runs only when such lines exist: on a fresh database this
-- migration shares its transaction with 0004, where the new enum values cannot
-- be used yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "transactions"
    WHERE "label" = 'Ajustement de trésorerie' AND "product_id" IS NULL AND "kind" IN ('vente', 'rachat')
  ) THEN
    EXECUTE $sql$
      UPDATE "transactions"
      SET "kind" = CASE "kind" WHEN 'vente' THEN 'entree'::"transaction_kind" ELSE 'sortie'::"transaction_kind" END
      WHERE "label" = 'Ajustement de trésorerie' AND "product_id" IS NULL AND "kind" IN ('vente', 'rachat')
    $sql$;
  END IF;
END $$;
