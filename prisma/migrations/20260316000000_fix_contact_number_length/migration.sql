-- AlterColumn: widen contact.number from VARCHAR(15) to VARCHAR(20)
-- to match the updated Prisma schema and support international phone formats
ALTER TABLE "contact" ALTER COLUMN "number" TYPE VARCHAR(20);
