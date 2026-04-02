CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'TERMINATED');

CREATE TYPE "DealActivityType" AS ENUM ('CONTRACT_TERMINATED');

ALTER TABLE "deal"
ADD COLUMN "contract_status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "terminated_at" TIMESTAMP(3),
ADD COLUMN "termination_reason" VARCHAR(120),
ADD COLUMN "termination_notes" TEXT,
ADD COLUMN "terminated_by_id" TEXT;

ALTER TABLE "deal"
ADD CONSTRAINT "deal_terminated_by_id_fkey"
FOREIGN KEY ("terminated_by_id") REFERENCES "bd"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "deal_activity" (
  "id" TEXT NOT NULL,
  "deal_id" TEXT NOT NULL,
  "type" "DealActivityType" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "effective_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT NOT NULL,

  CONSTRAINT "deal_activity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "deal_activity"
ADD CONSTRAINT "deal_activity_deal_id_fkey"
FOREIGN KEY ("deal_id") REFERENCES "deal"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deal_activity"
ADD CONSTRAINT "deal_activity_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "bd"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
