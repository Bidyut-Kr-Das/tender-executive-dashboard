import { prisma } from "@/lib/prisma";
import type { SmartsheetTender } from "@/types/smartsheetTender";

export class DatabaseSmartsheetService {
  static async upsertSmartsheetTenders(records: SmartsheetTender[]): Promise<void> {
    if (!prisma || records.length === 0) return;

    const validRecords = records.filter((r) => r.docketNumber && r.docketNumber.trim() !== "");

    for (const record of validRecords) {
      const data: any = {
        enquiryDate: record.enquiryDate || null,
        partyName: record.partyName || null,
        docketNumber: record.docketNumber,
        utility: record.utility || null,
        quotationNumber: record.quotationNumber || null,
        quotationDate: record.quotationDate || null,
        accountHolder: record.accountHolder || null,
        tenderPurchase: record.tenderPurchase || null,
        attachmentUrl: record.attachmentUrl || null,
        proposedErpItemName: record.proposedErpItemName || null,
        proposedQty: record.proposedQty || null,
        priceBasis: record.priceBasis || null,
        aluminiumPrice: record.aluminiumPrice ?? null,
        aluminiumAlloyPrice: record.aluminiumAlloyPrice ?? null,
        copperTapePrice: record.copperTapePrice ?? null,
        extrudedSemiconductivePrice: record.extrudedSemiconductivePrice ?? null,
        htXlpePrice: record.htXlpePrice ?? null,
        pvcTypeSt2Price: record.pvcTypeSt2Price ?? null,
        galvanisedSteelFlatStripPrice: record.galvanisedSteelFlatStripPrice ?? null,
        fillerPrice: record.fillerPrice ?? null,
        lastSyncedAt: new Date(),
      };

      try {
          await prisma.smartsheetTender.upsert({
          where: { docketNumber: record.docketNumber! },
          update: data,
          create: data,
        });
      } catch (err) {
        console.error(`[DatabaseSmartsheetService] Upsert failure for docket "${record.docketNumber}":`, err);
      }
    }

    console.log(`[DatabaseSmartsheetService] Upserted ${validRecords.length} records`);
  }
}
