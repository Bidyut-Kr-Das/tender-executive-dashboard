-- AlterTable
ALTER TABLE "performance_certificates" ADD COLUMN     "partyReferenceNo" TEXT;

-- CreateTable
CREATE TABLE "_CertSupplyHistory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CertSupplyHistory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CertSupplyHistory_B_index" ON "_CertSupplyHistory"("B");

-- AddForeignKey
ALTER TABLE "_CertSupplyHistory" ADD CONSTRAINT "_CertSupplyHistory_A_fkey" FOREIGN KEY ("A") REFERENCES "performance_certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CertSupplyHistory" ADD CONSTRAINT "_CertSupplyHistory_B_fkey" FOREIGN KEY ("B") REFERENCES "SupplyHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
