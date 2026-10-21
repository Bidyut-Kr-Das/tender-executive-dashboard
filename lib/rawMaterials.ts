export type RawMaterialEntry = [string, unknown];

function parseRawMaterials(value: unknown): RawMaterialEntry[] {
  if (value == null || value === "") return [];
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null) {
        return Object.entries(parsed as Record<string, unknown>);
      }
    } catch {}
  }
  return [];
}

const normalizeKey = (key: string): string => key.trim().toLowerCase();

export function isAlu(key: string): boolean {
  const k = normalizeKey(key);
  if (k.includes("alloy")) return false;
  return (
    k === "al" ||
    k.startsWith("aluminium") ||
    k.startsWith("aluminum") ||
    k.startsWith("alumimium")
  );
}

export function isCu(key: string): boolean {
  const k = normalizeKey(key);
  return k === "cu" || k.includes("copper");
}

/**
 * SQL mirrors of isAlu / isCu, for the server-side rawMaterials filter.
 * Applied to lower(btrim(key)) with Postgres `~`. Kept next to the functions
 * above so the two definitions cannot drift apart.
 */
export const ALU_KEY_SQL_PATTERN = "^(al$|alumi(ni|n|mi)um)";
export const ALU_KEY_SQL_EXCLUDE = "alloy";
export const CU_KEY_SQL_PATTERN = "(^cu$|copper)";

export function anyRawMaterialInRange(
  value: unknown,
  keyMatcher: (key: string) => boolean,
  min: number,
  max: number,
): boolean {
  for (const [key, v] of parseRawMaterials(value)) {
    if (v === null || v === undefined) continue;
    if (!keyMatcher(key)) continue;
    const str = String(v).trim();
    if (str === "") continue;
    const num = Number(str);
    if (isNaN(num)) continue;
    if (num >= min && num <= max) return true;
  }
  return false;
}
