-- AlterTable
ALTER TABLE "CostingSheetDetails" ADD COLUMN     "differenceBetweenRank1" TEXT,
ADD COLUMN     "differenceBetweenRank2" TEXT,
ADD COLUMN     "nameOfRank1" TEXT,
ADD COLUMN     "nameOfRank2" TEXT,
ADD COLUMN     "ourRank" TEXT,
ADD COLUMN     "ourValue" TEXT,
ADD COLUMN     "valueOfRank1" TEXT,
ADD COLUMN     "valueOfRank2" TEXT;

-- AlterTable
ALTER TABLE "tender_merged" ADD COLUMN     "itemWiseRankEnabled" BOOLEAN NOT NULL DEFAULT false;
