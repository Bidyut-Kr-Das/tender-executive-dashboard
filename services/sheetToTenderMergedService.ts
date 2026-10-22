import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { GoogleSheetService } from "./googleSheetService";
import { AttachmentJoinService } from "./attachmentJoinService";
import { TENDER_FILE_TYPES } from "@/lib/tender-file-types";
import { encryptRelativePath } from "@/lib/fileCrypto";
import { toPortableRelative } from "@/lib/pathUtils";
import { publishTenderParsingTask } from "@/lib/queue/publisher";
import { describeTenderFile } from "@/lib/tenderFileDescriptor";
import type { EpcTenderRecord } from "@/types/tender";

export interface SyncResult {
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    linked: number;
    errors: number;
  };
}

async function publishCostingParsingJob(params: {
  tenderMergedId: number;
  referenceNo?: string;
  file: { source: string | null; url: string | null };
}): Promise<void> {
  try {
    if (!params.referenceNo || params.referenceNo.trim() === "") {
      console.warn(
        `[SheetSync] Tender ${params.tenderMergedId} has no referenceNo, skipping CVA parse job`,
      );
      return;
    }
    const { file_type, decrypted_fileId } = describeTenderFile(params.file);
    if (!decrypted_fileId) {
      console.warn(
        `[SheetSync] No decrypted file id for costing of tender ${params.tenderMergedId}, skipping CVA parse job`,
      );
      return;
    }
    const ok = await publishTenderParsingTask({
      type: "COSTING_ATTACHMENT_PARSING",
      tenderId: params.tenderMergedId,
      referenceNo: params.referenceNo,
      file_link: params.file.url ?? "",
      file_type,
      decrypted_fileId,
      timestamp: Date.now(),
    });
    if (!ok) {
      console.warn(
        `[SheetSync] Failed to publish CVA parse job for tender ${params.tenderMergedId}`,
      );
    } else {
      console.log(
        `[SheetSync] Published CVA parse job for tender ${params.tenderMergedId} (referenceNo="${params.referenceNo}", file_type="${file_type}", decrypted_fileId="${decrypted_fileId}")`,
      );
    }
  } catch (err) {
    console.warn(
      `[SheetSync] Error publishing CVA parse job for tender ${params.tenderMergedId}: ${(err as Error).message}`,
    );
  }
}

export async function syncSheetToTenderMerged(): Promise<SyncResult> {
  const summary = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    linked: 0,
    errors: 0,
  };

  const sheetService = new GoogleSheetService();
  let records: EpcTenderRecord[];
  try {
    records = await sheetService.fetchTenderRecords({ onlyTendersMissingCosting: true });
  } catch (e) {
    throw new Error(`Failed to fetch sheet data: ${(e as Error).message}`);
  }

  console.log("[SheetSync] Fetched", records.length, "records from sheet");
  console.log("[SheetSync] Sample (first 10):");
  for (let i = 0; i < Math.min(records.length, 10); i++) {
    const r = records[i];
    console.log(
      "[SheetSync] [" + (i + 1) + "]",
      JSON.stringify(
        {
          tenderNoNitNo: r.tenderNoNitNo,
          docketNo: r.docketNo,
          tenderType: r.tenderType,
          nameOfWorkDescription: r.nameOfWorkDescription,
          nameOfTheClient: r.nameOfTheClient,
          lastDateOfSubmission: r.lastDateOfSubmission,
          tenderSubmittedDate: r.tenderSubmittedDate,
          managementDecision: r.managementDecision,
          participated: r.participated,
          currentStatus: r.currentStatus,
          price: r.price,
          attachmentUrl: r.attachmentUrl,
          itemCategory: r.itemCategory,
          tenderPrepareBy: r.tenderPrepareBy,
        },
        null,
        2,
      ),
    );
  }

  summary.total = records.length;

  // ── Costing attachment sync from fetched records ──
  const allTenders = await prisma.tenderMerged.findMany({
    select: { id: true, referenceNo: true, docketNo: true },
  });
  const docketToTender = new Map(
    allTenders
      .filter((t) => t.docketNo)
      .map((t) => [
        AttachmentJoinService.normalizeKey(t.docketNo),
        { id: t.id, referenceNo: t.referenceNo },
      ] as const),
  );
  let costingCount = 0;

  for (const row of records) {
    const docketNo = AttachmentJoinService.normalizeKey(row.docketNo);
    if (!docketNo) continue;
    const matched = docketToTender.get(docketNo);
    if (!matched) continue;
    const { id: mergedId, referenceNo: refNo } = matched;

    if (row.attachmentUrl) {
      await prisma.tenderFile.deleteMany({
        where: {
          tenderMergedId: mergedId,
          tags: { has: TENDER_FILE_TYPES.COSTING_ATTACHMENT },
        },
      });
      const urlStr = row.attachmentUrl;
      let name: string;
      let extension: string;

      if (urlStr.includes("appsheet.com")) {
        const parsedUrl = new URL(urlStr);
        const rawFilename = parsedUrl.searchParams.get("FILENAME") || "";
        const decodedFilename = decodeURIComponent(rawFilename);
        const actualFilename = decodedFilename.split("/").pop() || "";
        const dotIdx = actualFilename.lastIndexOf(".");
        if (dotIdx > 0) {
          name = actualFilename.slice(0, dotIdx);
          extension = actualFilename.slice(dotIdx + 1);
        } else {
          name = actualFilename || "attachment";
          extension = "";
        }
      } else {
        const urlParts = urlStr.split("/").pop()?.split(".") || [];
        name =
          urlParts.length > 1
            ? urlParts.slice(0, -1).join(".")
            : urlParts[0] || "attachment";
        extension =
          urlParts.length > 1 ? urlParts[urlParts.length - 1] : "";
      }
      await prisma.tenderFile.create({
        data: {
          name,
          extension,
          url: urlStr,
          source: "SHEET_SYNC",
          tags: [TENDER_FILE_TYPES.COSTING_ATTACHMENT],
          tenderMergedId: mergedId,
        },
      });
      costingCount++;
      console.log("[SheetSync] Created TenderFile for", refNo, {
        name,
        extension,
        url: urlStr,
        tenderMergedId: mergedId,
      });
      await publishCostingParsingJob({
        tenderMergedId: mergedId,
        referenceNo: refNo,
        file: { source: "SHEET_SYNC", url: urlStr },
      });
    }
  }
  summary.created = costingCount;

  // ── Condutor BoQ comparative chart files ──
  try {
    const condutorPath = process.env.CONDUTOR_PATH;
    if (!condutorPath) {
      console.warn(
        "[SheetSync] CONDUTOR_PATH not set, skipping BoQ comparative chart sync",
      );
    } else {
      const resolvedCondutorPath = path.resolve(
        /* turbopackIgnore: true */
        condutorPath,
      );
      if (!fs.existsSync(resolvedCondutorPath)) {
        console.warn(
          "[SheetSync] CONDUTOR_PATH not found:",
          resolvedCondutorPath,
        );
      } else {
        const tenderIdPattern = /(\d{4}_[A-Z]+_\d+_\d+)/;
        const condutorMap = new Map<string, string>();
        const condutorFiles = fs.readdirSync(resolvedCondutorPath);
        for (const filename of condutorFiles) {
          if (!filename.toLowerCase().endsWith(".xlsx")) continue;
          const match = filename.match(tenderIdPattern);
          if (!match) continue;
          const tenderId = match[1];
          const cleanId = tenderId.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!cleanId) continue;
          const filePath = path.join(resolvedCondutorPath, filename);
          if (!condutorMap.has(cleanId)) {
            condutorMap.set(cleanId, filePath);
          } else if (!/\(\d+\)/.test(filename)) {
            condutorMap.set(cleanId, filePath);
          }
        }

        if (condutorMap.size > 0) {
          const condutorTenders = await prisma.tenderMerged.findMany({
            select: { id: true, referenceNo: true },
          });

          let matchedCount = 0;
          for (const tm of condutorTenders) {
            if (!tm.referenceNo) continue;
            const cleanRefNo = tm.referenceNo
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");
            if (!cleanRefNo) continue;

            let matchedPath: string | undefined;
            for (const [condutorCleanId, condutorFilePath] of condutorMap) {
              if (
                cleanRefNo.includes(condutorCleanId) ||
                condutorCleanId.includes(cleanRefNo)
              ) {
                matchedPath = condutorFilePath;
                break;
              }
            }

            if (!matchedPath) continue;
            matchedCount++;

            await prisma.tenderFile.deleteMany({
              where: {
                tenderMergedId: tm.id,
                tags: { has: TENDER_FILE_TYPES.BOQ_COMPARATIVE_CHART },
              },
            });

            const filename = path.basename(matchedPath);
            const ext = path.extname(filename);
            const name = ext ? filename.slice(0, -ext.length) : filename;
            const condutorRoot = path.resolve(
              /* turbopackIgnore: true */
              process.env.CONDUTOR_PATH!,
            );
            const relativePath = toPortableRelative(path.relative(condutorRoot, matchedPath));
            await prisma.tenderFile.create({
              data: {
                name,
                extension: ext.replace(".", ""),
                url: relativePath,
                source: encryptRelativePath("condutor", relativePath),
                tags: [TENDER_FILE_TYPES.BOQ_COMPARATIVE_CHART],
                tenderMergedId: tm.id,
              },
            });
          }

          console.log(
            `[SheetSync] BoQ comparative chart synced for ${matchedCount} tenders from Condutor`,
          );
        }
      }
    }
  } catch (e) {
    console.warn("[SheetSync] Condutor BoQ scan failed:", (e as Error).message);
  }

  return {
    summary,
  };
}
