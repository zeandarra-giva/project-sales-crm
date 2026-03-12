-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BD_REP', 'SALES_MANAGER');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('INBOUND', 'OUTBOUND', 'REFERRAL');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ENTERPRISE', 'CORPORATE', 'SMB', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT');

-- CreateEnum
CREATE TYPE "DecisionRank" AS ENUM ('TIER_1_ECONOMIC_BUYER', 'TIER_2_DECISION_MAKER', 'TIER_3_INFLUENCER', 'TIER_4_END_USER', 'TIER_5_GATEKEEPER');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('STAGE_CHANGE', 'DEAL_STUCK', 'ACTION_PLAN_DUE', 'FOLLOW_UP_DUE', 'QUOTA_BEHIND_PACE', 'NEW_DEAL_ASSIGNED', 'LOST_DEAL_FOLLOW_UP');

-- CreateEnum
CREATE TYPE "NotificationTrigger" AS ENUM ('STAGE_CHANGE', 'ACTION_PLAN_PASSED', 'DAYS_IN_STAGE_EXCEEDED', 'NO_FOLLOW_UP_IN_14_DAYS', 'QUOTA_BEHIND_PACE', 'CLOSED_LOST_AGE');

-- CreateTable
CREATE TABLE "pipeline_stage" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "duration" INTEGER,

    CONSTRAINT "pipeline_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "parent_industry_id" TEXT,

    CONSTRAINT "industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bd" (
    "id" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BD_REP',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(30) NOT NULL,

    CONSTRAINT "bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_service" (
    "service_id" TEXT NOT NULL,
    "bundle_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "service_value" DECIMAL(65,30) NOT NULL,
    "revenue_share_pct" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "bundle_service_pkey" PRIMARY KEY ("service_id","bundle_id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "brand" VARCHAR(100),
    "account_type" "AccountType" NOT NULL,
    "type" VARCHAR(30),
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "industry_id" TEXT,
    "contact_id" TEXT,
    "referral_id" TEXT,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL,
    "first_name" VARCHAR(30) NOT NULL,
    "last_name" VARCHAR(30) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "number" VARCHAR(15),
    "designation" VARCHAR(100),
    "decision_rank" "DecisionRank" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "client_id" TEXT NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_dimension" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "month_number" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "is_quarter_end" BOOLEAN NOT NULL,

    CONSTRAINT "date_dimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal" (
    "id" TEXT NOT NULL,
    "deal_name" VARCHAR(255) NOT NULL,
    "monthly_subscription" DECIMAL(65,30) NOT NULL,
    "revenue" DECIMAL(65,30),
    "duration" INTEGER NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "action_plan" TEXT,
    "proposal_revision_count" INTEGER NOT NULL DEFAULT 0,
    "proposal_link" TEXT,
    "contract_link" TEXT,
    "lead_source" "LeadSource" NOT NULL,
    "final_proposed_value" DECIMAL(65,30),
    "sales_cycle_days" INTEGER,
    "stage_id" TEXT NOT NULL,
    "bd_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "service_id" TEXT,
    "bundle_id" TEXT,
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "closed_date" TIMESTAMP(3),
    "last_stage_update_at" TIMESTAMP(3),
    "last_follow_up_at" TIMESTAMP(3),
    "initial_meeting_date" TIMESTAMP(3),
    "action_plan_due_date" TIMESTAMP(3),

    CONSTRAINT "deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_audit_log" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL,
    "exited_at" TIMESTAMP(3),
    "days_in_stage" INTEGER,
    "changed_by" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "deal_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_projection" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "bd_id" TEXT NOT NULL,
    "projected_amount" DECIMAL(65,30) NOT NULL,
    "probability_pct" DECIMAL(65,30) NOT NULL,
    "weighted_value" DECIMAL(65,30),
    "date_id" TEXT,

    CONSTRAINT "deal_projection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_contact" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "role_in_deal" VARCHAR(100),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "last_contacted" TIMESTAMP(3),

    CONSTRAINT "deal_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target" (
    "id" TEXT NOT NULL,
    "quota" DECIMAL(65,30) NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "date_id" TEXT,
    "bd_id" TEXT NOT NULL,

    CONSTRAINT "target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_snapshot" (
    "id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "probability_pct" DECIMAL(65,30),
    "projected_amount" DECIMAL(65,30),
    "weighted_value" DECIMAL(65,30),
    "remarks" TEXT,
    "action_plan" TEXT,
    "deal_id" TEXT NOT NULL,
    "date_id" TEXT,

    CONSTRAINT "deal_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_snapshot" (
    "id" TEXT NOT NULL,
    "total_pipeline_value" DECIMAL(65,30) NOT NULL,
    "total_weighted_value" DECIMAL(65,30) NOT NULL,
    "deal_count" INTEGER NOT NULL,
    "bd_id" TEXT,
    "snapshot_date_id" TEXT,

    CONSTRAINT "forecast_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "triggered_by" "NotificationTrigger" NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bd_id" TEXT NOT NULL,
    "deal_id" TEXT,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "date_id" TEXT,
    "deal_id" TEXT NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stage_name_key" ON "pipeline_stage"("name");

-- CreateIndex
CREATE UNIQUE INDEX "industry_name_key" ON "industry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bd_email_key" ON "bd"("email");

-- CreateIndex
CREATE UNIQUE INDEX "service_name_key" ON "service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "deal_projection_deal_id_key" ON "deal_projection"("deal_id");

-- AddForeignKey
ALTER TABLE "industry" ADD CONSTRAINT "industry_parent_industry_id_fkey" FOREIGN KEY ("parent_industry_id") REFERENCES "industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_service" ADD CONSTRAINT "bundle_service_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_service" ADD CONSTRAINT "bundle_service_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_bd_id_fkey" FOREIGN KEY ("bd_id") REFERENCES "bd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_audit_log" ADD CONSTRAINT "deal_audit_log_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_audit_log" ADD CONSTRAINT "deal_audit_log_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_audit_log" ADD CONSTRAINT "deal_audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "bd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_projection" ADD CONSTRAINT "deal_projection_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_projection" ADD CONSTRAINT "deal_projection_bd_id_fkey" FOREIGN KEY ("bd_id") REFERENCES "bd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_projection" ADD CONSTRAINT "deal_projection_date_id_fkey" FOREIGN KEY ("date_id") REFERENCES "date_dimension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_contact" ADD CONSTRAINT "deal_contact_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_contact" ADD CONSTRAINT "deal_contact_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target" ADD CONSTRAINT "target_bd_id_fkey" FOREIGN KEY ("bd_id") REFERENCES "bd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target" ADD CONSTRAINT "target_date_id_fkey" FOREIGN KEY ("date_id") REFERENCES "date_dimension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_snapshot" ADD CONSTRAINT "deal_snapshot_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_snapshot" ADD CONSTRAINT "deal_snapshot_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_snapshot" ADD CONSTRAINT "deal_snapshot_date_id_fkey" FOREIGN KEY ("date_id") REFERENCES "date_dimension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_snapshot" ADD CONSTRAINT "forecast_snapshot_bd_id_fkey" FOREIGN KEY ("bd_id") REFERENCES "bd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_snapshot" ADD CONSTRAINT "forecast_snapshot_snapshot_date_id_fkey" FOREIGN KEY ("snapshot_date_id") REFERENCES "date_dimension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_bd_id_fkey" FOREIGN KEY ("bd_id") REFERENCES "bd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_date_id_fkey" FOREIGN KEY ("date_id") REFERENCES "date_dimension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
