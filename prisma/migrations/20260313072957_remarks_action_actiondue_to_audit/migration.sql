/*
  Warnings:

  - You are about to drop the column `action_plan` on the `deal` table. All the data in the column will be lost.
  - You are about to drop the column `action_plan_due_date` on the `deal` table. All the data in the column will be lost.
  - You are about to drop the column `remarks` on the `deal` table. All the data in the column will be lost.
  - Added the required column `action_plan` to the `deal_audit_log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `action_plan_due_date` to the `deal_audit_log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `remarks` to the `deal_audit_log` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "deal" DROP COLUMN "action_plan",
DROP COLUMN "action_plan_due_date",
DROP COLUMN "remarks";

-- AlterTable
ALTER TABLE "deal_audit_log" ADD COLUMN     "action_plan" TEXT NOT NULL,
ADD COLUMN     "action_plan_due_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "remarks" TEXT NOT NULL;
