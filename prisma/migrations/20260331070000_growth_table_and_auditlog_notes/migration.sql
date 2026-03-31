-- Move note fields to the audit log structure expected by the app
ALTER TABLE "deal_audit_log"
ADD COLUMN IF NOT EXISTS "remarks" TEXT,
ADD COLUMN IF NOT EXISTS "action_plan" TEXT,
ADD COLUMN IF NOT EXISTS "action_plan_due_date" TIMESTAMP(3);

UPDATE "deal_audit_log" AS dal
SET
  "remarks" = COALESCE(dal."remarks", d."remarks"),
  "action_plan" = COALESCE(dal."action_plan", d."action_plan"),
  "action_plan_due_date" = COALESCE(dal."action_plan_due_date", d."action_plan_due_date")
FROM "deal" AS d
WHERE d."id" = dal."deal_id"
  AND dal."exited_at" IS NULL;

ALTER TABLE "deal"
DROP COLUMN IF EXISTS "remarks",
DROP COLUMN IF EXISTS "action_plan",
DROP COLUMN IF EXISTS "action_plan_due_date";

-- Persisted sandbox table for side-by-side growth comparisons
CREATE TABLE IF NOT EXISTS "growth_entry" (
  "id" TEXT NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "year" INTEGER NOT NULL,
  "quarter" INTEGER,
  "revenue" DECIMAL(65,30) NOT NULL,
  "notes" TEXT,
  "owner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "growth_entry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "growth_entry_year_quarter_idx"
  ON "growth_entry"("year", "quarter");

CREATE INDEX IF NOT EXISTS "growth_entry_label_year_quarter_idx"
  ON "growth_entry"("label", "year", "quarter");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'growth_entry_owner_id_fkey'
      AND table_name = 'growth_entry'
  ) THEN
    ALTER TABLE "growth_entry"
    ADD CONSTRAINT "growth_entry_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "bd"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
