import * as XLSX from "xlsx";
import type { MaterialPattern, MaterialMatch, ColumnMap } from "@/types/costing";

const MATERIAL_PATTERNS: MaterialPattern[] = [
  { key: "aluminium", patterns: [/^alumini?um$/i, /^al$/i, /^al\.$/i] },
  { key: "aluminiumAlloy", patterns: [/^alumini?um\s+alloy$/i, /^al\.?\s*alloy$/i] },
  { key: "copperTape", patterns: [/^copper/i] },
  { key: "extrudedSemiconductive", patterns: [/^extruded\s+semiconductive/i, /^semiconductive$/i, /^semicon$/i] },
  { key: "htXlpe", patterns: [/^ht[\s-]?xlpe$/i, /^lt[\s-]?xlpe$/i, /^tr\s+xlpe$/i, /^xlpe$/i] },
  { key: "pvc", patterns: [/^pvc$/i] },
  { key: "pvcTypeSt1", patterns: [/^pvc\s+type\s+st[\s-]?1$/i, /^pvc\s+st[\s-]?1$/i, /^pvc[\s-]1$/i] },
  { key: "pvcTypeSt2", patterns: [/^pvc\s+type\s+st[\s-]?2$/i, /^pvc\s+st[\s-]?2$/i, /^st[\s-]2$/i, /^pvc[\s-]?2$/i] },
  { key: "innerSheath", patterns: [/^inner\s+sheath/i, /^inner\s+sheathing/i, /^inner$/i] },
  { key: "armouring", patterns: [/^armour/i] },
  { key: "galvanisedSteelRoundWire", patterns: [/^galvanis/i, /^g\.?\s*i\.?\s*wire/i, /^steel\s+round\s+wire/i, /^steel\s+wire/i] },
  { key: "galvanisedSteelFlatStrip", patterns: [/^galvanis/i, /^steel\s+flat/i] },
  { key: "outerSheath", patterns: [/^outer\s+sheath/i, /^outer\s+sheathing/i, /^outer$/i] },
  { key: "filler", patterns: [/^filler$/i] },
  { key: "waterSwellableTape", patterns: [/^water\s+swellable/i, /^swellable\s+tape/i, /^wst$/i] },
  { key: "rpct", patterns: [/^rpct$/i, /^r\.?\s*p\.?\s*c\.?\s*t\.?$/i] },
];

const QTY_PATTERNS = [/^qty$/i, /^qty\.$/i, /^quantity$/i, /^quantity\(/i, /^qty\(/i];

function normalizeHeader(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text.trim().toLowerCase().replace(/[\s]+/g, " ").replace(/[^\w\s]/g, "").trim();
}

function matchMaterial(headerText: string): MaterialMatch[] | null {
  const normalized = normalizeHeader(headerText);
  if (!normalized) return null;

  const results: MaterialMatch[] = [];
  for (const entry of MATERIAL_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(normalized)) {
        results.push({ key: entry.key, pattern, normalized });
        break;
      }
    }
  }
  return results.length > 0 ? results : null;
}

function isQtyHeader(headerText: string): boolean {
  const normalized = normalizeHeader(headerText);
  if (!normalized) return false;
  return QTY_PATTERNS.some((p) => p.test(normalized));
}

function isLikelyHeaderCell(text: unknown): boolean {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  if (t.length === 0) return false;
  if (/^[\d.,%]+$/.test(t)) return false;
  return true;
}

function normalizeSheetName(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function findCostingSheet(workbook: XLSX.WorkBook, preferredName = "AUTO CALCULATION SHEET (2)"): string | null {
  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    return null;
  }

  const preferredNormalized = normalizeSheetName(preferredName);
  const exactMatch = workbook.SheetNames.find((name) => normalizeSheetName(name) === preferredNormalized);
  if (exactMatch) {
    return exactMatch;
  }

  let bestSheetName = workbook.SheetNames[0];
  let bestScore = -1;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    let score = 0;
    const normalizedName = normalizeSheetName(sheetName);

    if (preferredNormalized && normalizedName) {
      if (normalizedName === preferredNormalized) {
        score += 100;
      } else if (normalizedName.includes(preferredNormalized) || preferredNormalized.includes(normalizedName)) {
        score += 80;
      } else if (
        (normalizedName.includes("calculation") || normalizedName.includes("auto")) &&
        (preferredNormalized.includes("calculation") || preferredNormalized.includes("auto"))
      ) {
        score += 40;
      }
    }

    if (normalizedName.includes("calculation") || normalizedName.includes("cost")) {
      score += 20;
    }

    if (sheet && sheet["!ref"]) {
      const rows = XLSX.utils.sheet_to_json<(string | null)[]>(sheet, { header: 1, defval: null });
      if (rows && rows.length > 0) {
        const headerRowIdx = detectHeaderRow(rows, 20);
        if (headerRowIdx !== -1) {
          const headers = rows[headerRowIdx].map((c) => c !== null && c !== undefined ? String(c) : "");
          const { qtyCol, materialCols } = buildColumnMap(headers);
          score += 50 + (materialCols.size * 10) + (qtyCol !== -1 ? 10 : 0);
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSheetName = sheetName;
    }
  }

  return bestSheetName;
}

function detectHeaderRow(rows: (string | null)[][], maxLookup = 20): number {
  let bestRow = -1;
  let bestScore = 0;

  for (let r = 0; r < Math.min(maxLookup, rows.length); r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let qtyFound = false;
    let materialCount = 0;
    let textCellCount = 0;

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell || typeof cell !== "string") continue;
      const text = cell.trim();
      if (!text) continue;

      if (!isLikelyHeaderCell(text)) continue;
      textCellCount++;

      if (isQtyHeader(text)) {
        qtyFound = true;
      }

      const matched = matchMaterial(text);
      if (matched) {
        materialCount++;
      }
    }

    if (textCellCount < 2) continue;

    let score = 0;
    if (qtyFound) score += 10;
    score += materialCount * 3;

    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  if (bestScore < 10) return -1;
  return bestRow;
}

function buildColumnMap(headers: string[]): ColumnMap {
  let qtyCol = -1;
  const materialCols = new Map<string, number>();

  for (let c = 0; c < headers.length; c++) {
    const header = headers[c];
    if (!header || typeof header !== "string") continue;
    const text = header.trim();
    if (!text) continue;

    if (isQtyHeader(text)) {
      qtyCol = c;
      continue;
    }

    const matched = matchMaterial(text);
    if (matched) {
      for (const m of matched) {
        if (!materialCols.has(m.key)) {
          materialCols.set(m.key, c);
        }
      }
    }
  }

  return { qtyCol, materialCols };
}
