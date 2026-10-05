-- AlterTable
ALTER TABLE "tender_files" ADD COLUMN     "parseError" TEXT,
ADD COLUMN     "parseResult" JSONB,
ADD COLUMN     "parseStatus" TEXT;
