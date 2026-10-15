/*
  Warnings:

  - A unique constraint covering the columns `[serial]` on the table `performance_certificates` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "performance_certificates" ADD COLUMN     "duplicateOfId" TEXT,
ADD COLUMN     "serial" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "performance_certificates_serial_key" ON "performance_certificates"("serial");

-- CreateIndex
CREATE INDEX "performance_certificates_duplicateOfId_idx" ON "performance_certificates"("duplicateOfId");

-- AddForeignKey
ALTER TABLE "performance_certificates" ADD CONSTRAINT "performance_certificates_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "performance_certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
