const IST_TZ = "Asia/Kolkata";

function ordinalSuffix(n: number): string {
  if (n > 3 && n < 21) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/**
 * Returns YYYY-MM-DD string for the given instant in IST.
 * Works regardless of browser local timezone.
 */
export function toISTDateKey(val: Date | string | number | null | undefined): string | null {
  if (val == null || val === "") return null;
  const d = val instanceof Date ? val : new Date(val as string | number);
  if (isNaN(d.getTime())) return null;
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Inverse of `toISTDateKey`: the instant IST midnight of a `YYYY-MM-DD` key, null when empty or malformed. */
export function istDateKeyToDate(key: string | null | undefined): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00+05:30`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Short format used in TenderTable: DD-MMM-YY (e.g. 25-Aug-25) in IST
 */
export function formatDateISTShort(val: Date | string | number | null | undefined): string {
  if (val == null || (typeof val === "string" && val.trim() === "")) return "-";
  const d = val instanceof Date ? val : new Date(val as string | number);
  if (isNaN(d.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${day}-${month}-${year}`;
}

/**
 * Long format used in OptimizedTenderTable / viewer: do MMM, yyyy (e.g. 25th Aug, 2025) in IST
 */
export function formatDateISTLong(val: Date | string | number | null | undefined): string {
  if (val == null || (typeof val === "string" && val.trim() === "")) return "-";
  const d = val instanceof Date ? val : new Date(val as string | number);
  if (isNaN(d.getTime())) return "-";
  const dayNum = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: IST_TZ,
      day: "numeric",
    }).format(d)
  );
  const monthShort = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    month: "short",
  }).format(d);
  const year = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    year: "numeric",
  }).format(d);
  return `${dayNum}${ordinalSuffix(dayNum)} ${monthShort}, ${year}`;
}

/**
 * Returns true if the given date (instant) is before today in IST (calendar day).
 * Today is calculated in IST.
 */
export function isBeforeTodayIST(val: Date | string | number | null | undefined): boolean {
  if (val == null || val === "") return false;
  const dateKey = toISTDateKey(val);
  const todayKey = toISTDateKey(new Date());
  if (!dateKey || !todayKey) return false;
  return dateKey < todayKey;
}

// ---- IST week/month/year helpers for deadline presets ----
// These compute boundaries as YYYY-MM-DD strings in IST, regardless of local timezone.

function getISTPseudoDate(date: Date): Date {
  // Convert instant to pseudo date whose local components equal IST components
  return new Date(date.toLocaleString("en-US", { timeZone: IST_TZ }));
}

export function getISTWeekRange(date: Date = new Date()): { fromKey: string; toKey: string } {
  const pseudo = getISTPseudoDate(date);
  const day = pseudo.getDay(); // 0 Sun .. 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(pseudo);
  monday.setDate(pseudo.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fromKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  const toKey = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
  return { fromKey, toKey };
}

export function getISTMonthRange(date: Date = new Date()): { fromKey: string; toKey: string } {
  const pseudo = getISTPseudoDate(date);
  const y = pseudo.getFullYear();
  const m = pseudo.getMonth(); // 0-11
  const fromKey = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const toKey = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { fromKey, toKey };
}

export function getISTYearRange(date: Date = new Date()): { fromKey: string; toKey: string } {
  const pseudo = getISTPseudoDate(date);
  const y = pseudo.getFullYear();
  return { fromKey: `${y}-01-01`, toKey: `${y}-12-31` };
}

export function formatDateTimeIST(
  val: Date | string | number | null | undefined,
  pattern: "dd-MM-yyyy HH:mm" = "dd-MM-yyyy HH:mm"
): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(val as string | number);
  if (isNaN(d.getTime())) return "";
  // Use Intl for IST date/time parts
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  if (pattern === "dd-MM-yyyy HH:mm") return `${day}-${month}-${year} ${hour}:${minute}`;
  return `${day}-${month}-${year} ${hour}:${minute}`;
}
