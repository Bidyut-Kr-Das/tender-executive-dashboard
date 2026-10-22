/*
  Warnings:

  - You are about to drop the column `gemTenderId` on the `evaluations` table. All the data in the column will be lost.
  - You are about to drop the column `gemTenderId` on the `reportings` table. All the data in the column will be lost.
  - You are about to drop the column `gemTenderId` on the `tender_associations` table. All the data in the column will be lost.
  - You are about to drop the column `nonGemTenderId` on the `tender_associations` table. All the data in the column will be lost.
  - You are about to drop the `gem_tenders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `non_gem_tenders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tender_extra_fields` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_gemTenderId_fkey";

-- DropForeignKey
ALTER TABLE "gem_tenders" DROP CONSTRAINT "gem_tenders_fileId_fkey";

-- DropForeignKey
ALTER TABLE "gem_tenders" DROP CONSTRAINT "gem_tenders_tenderStatusId_fkey";

-- DropForeignKey
ALTER TABLE "gem_tenders" DROP CONSTRAINT "gem_tenders_utilityMappingId_fkey";

-- DropForeignKey
ALTER TABLE "non_gem_tenders" DROP CONSTRAINT "non_gem_tenders_fileId_fkey";

-- DropForeignKey
ALTER TABLE "non_gem_tenders" DROP CONSTRAINT "non_gem_tenders_tenderStatusId_fkey";

-- DropForeignKey
ALTER TABLE "non_gem_tenders" DROP CONSTRAINT "non_gem_tenders_utilityMappingId_fkey";

-- DropForeignKey
ALTER TABLE "reportings" DROP CONSTRAINT "reportings_gemTenderId_fkey";

-- DropForeignKey
ALTER TABLE "tender_associations" DROP CONSTRAINT "tender_associations_gemTenderId_fkey";

-- DropForeignKey
ALTER TABLE "tender_associations" DROP CONSTRAINT "tender_associations_nonGemTenderId_fkey";

-- DropForeignKey
ALTER TABLE "tender_extra_fields" DROP CONSTRAINT "tender_extra_fields_gemTenderId_fkey";

-- DropForeignKey
ALTER TABLE "tender_extra_fields" DROP CONSTRAINT "tender_extra_fields_nonGemTenderId_fkey";

-- DropForeignKey
ALTER TABLE "tender_extra_fields" DROP CONSTRAINT "tender_extra_fields_tenderMergedId_fkey";

-- DropIndex
DROP INDEX "evaluations_gemTenderId_idx";

-- DropIndex
DROP INDEX "reportings_gemTenderId_idx";

-- DropIndex
DROP INDEX "tender_associations_gemTenderId_associationId_key";

-- DropIndex
DROP INDEX "tender_associations_gemTenderId_idx";

-- DropIndex
DROP INDEX "tender_associations_nonGemTenderId_associationId_key";

-- DropIndex
DROP INDEX "tender_associations_nonGemTenderId_idx";

-- AlterTable
ALTER TABLE "evaluations" DROP COLUMN "gemTenderId";

-- AlterTable
ALTER TABLE "reportings" DROP COLUMN "gemTenderId";

-- AlterTable
ALTER TABLE "tender_associations" DROP COLUMN "gemTenderId",
DROP COLUMN "nonGemTenderId";

-- DropTable
DROP TABLE "gem_tenders";

-- DropTable
DROP TABLE "non_gem_tenders";

-- DropTable
DROP TABLE "tender_extra_fields";
