/**
 * Scan one or more root folders, recursively find every folder named
 * "performance certificate" (case-insensitive), collect ALL files inside
 * (nested subfolders included), upload each file to S3 as a permanent
 * public object, and insert a PerformanceCertificate row.
 *
 * Required env (in .env):
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION
 *   S3_BUCKET_NAME
 *   S3_PUBLIC_BASE_URL   (optional, e.g. https://cdn.example.com or a bucket URL)
 *
 * Usage:
 *   npx tsx scripts/sync-performance-certificates.ts
 *   npx tsx scripts/sync-performance-certificates.ts "D:\\folder1" "D:\\folder2"
 *   npx tsx scripts/sync-performance-certificates.ts --dry-run
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { uploadLocalFile, buildPublicUrl } from "../lib/s3";

// Edit here, or pass roots as CLI args.
const ROOTS: string[] = [
  // "D:\\path\\to\\root",
  // "W:\0 . SOUM",
  "\\\\192.168.1.242\\tender laser",
  "\\\\192.168.1.242\\e",
  "\\\\192.168.1.242\\markating"

];

// A folder matches when its name contains BOTH "performance" and "certificate"
// (case-insensitive), e.g. "Performance Certificate", "PERFORMANCE CERTIFICATES".
const KEY_PREFIX = "performance-certificates";

function isTargetFolder(name: string): boolean {
  const u = name.toUpperCase();
  return u.includes("PERFORMANCE") && u.includes("CERTIFICATE");
}

function findTargetFolders(root: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    if (isTargetFolder(entry.name)) {
      out.push(full);
      continue; // stop descending once a match is found
    }
    findTargetFolders(full, out);
  }
}

function collectFiles(dir: string, out: Set<string>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
    } else if (entry.isFile()) {
      if (entry.name.startsWith("~$")) continue;
      if (entry.name.toLowerCase().endsWith(".tmp")) continue;
      out.add(full);
    }
  }
}

function buildKey(absPath: string): string {
  const hash = crypto.createHash("md5").update(absPath).digest("hex").slice(0, 10);
  const base = path.basename(absPath).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${KEY_PREFIX}/${hash}-${base}`;
}

function parseArgs(): { roots: string[]; dryRun: boolean } {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const roots = args.filter((a) => !a.startsWith("--"));
  return { roots: roots.length ? roots : ROOTS, dryRun };
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s (${ms}ms)`;
}

async function main() {
  const startedAt = Date.now();
  const { roots, dryRun } = parseArgs();

  if (roots.length === 0) {
    console.error("[perf-cert] No roots provided. Set ROOTS in the script or pass paths as args.");
    process.exit(1);
  }

  if (!dryRun && (!process.env.S3_BUCKET_NAME || !process.env.AWS_REGION)) {
    console.error("[perf-cert] Missing S3_BUCKET_NAME or AWS_REGION env.");
    process.exit(1);
  }

  let created = 0;
  let skippedDup = 0;
  let failed = 0;
  let discovered = 0;

  for (const rootRaw of roots) {
    const rootStartedAt = Date.now();
    const root = path.resolve(rootRaw);
    if (!fs.existsSync(root)) {
      console.error(`[perf-cert] Root does not exist: ${root}`);
      continue;
    }

    const folders: string[] = [];
    findTargetFolders(root, folders);
    console.log(`[perf-cert] ${root} -> ${folders.length} performance/certificate folder(s)`);

    const files = new Set<string>();
    for (const folder of folders) collectFiles(folder, files);
    discovered += files.size;

    for (const absPath of files) {
      const name = path.basename(absPath);
      try {
        const key = buildKey(absPath);
        const url = buildPublicUrl(key);

        if (dryRun) {
          console.log(`  [DRY] ${name} -> ${url}`);
          continue;
        }

        const existing = await prisma.performanceCertificate.findFirst({
          where: { certificateUrl: url },
          select: { id: true },
        });
        if (existing) {
          skippedDup++;
          continue;
        }

        await uploadLocalFile(absPath, { key });

        await prisma.performanceCertificate.create({
          data: { certificateName: name, certificateUrl: url },
        });
        created++;
        console.log(`  [OK] ${name}`);
      } catch (err) {
        failed++;
        console.error(`  [FAIL] ${name}: ${(err as Error).message}`);
      }
    }

    console.log(
      `[perf-cert] Root done in ${formatDuration(Date.now() - rootStartedAt)}: ${root}`,
    );
  }

  console.log("\n--- Summary ---");
  console.log(`  Files discovered: ${discovered}`);
  console.log(`  Created:          ${created}`);
  console.log(`  Skipped (dup):    ${skippedDup}`);
  console.log(`  Failed:           ${failed}`);
  console.log(`  Total time:       ${formatDuration(Date.now() - startedAt)}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[perf-cert] Fatal error:", err);
  prisma.$disconnect().then(() => process.exit(1));
});
