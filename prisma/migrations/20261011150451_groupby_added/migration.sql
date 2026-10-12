-- AlterTable
ALTER TABLE "tender_merged" ADD COLUMN     "lifecycleError" TEXT,
ADD COLUMN     "lifecycleStatus" TEXT,
ADD COLUMN     "lifecycleUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tender_merged_lifecycleStatus_idx" ON "tender_merged"("lifecycleStatus");
