/**
 * Rupee amounts as people and sheets write them: "1.5 Cr", "Rs 7.42 L",
 * "₹ 12,34,567/-", "1,00,000 Rs", "12.5 lakh", "800k", or an Excel number cell.
 */

const UNITS: Record<string, number> = {
  cr: 1e7,
  crs: 1e7,
  crore: 1e7,
  crores: 1e7,
  l: 1e5,
  lac: 1e5,
  lacs: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  k: 1e3,
  thousand: 1e3,
};

/** The amount in rupees, or null when the input is empty or not an amount. */
export function parseRupees(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? input : null;
  if (input == null) return null;
  // Currency words go wherever they stand ("Rs 5 L", "1,00,000 Rs", "Rupees 5
  // lakh only"). The letter lookbehind keeps the "rs" of "5 crs" in place.
  const text = String(input)
    .toLowerCase()
    .replace(/₹|\/-|(?<![a-z])(rs\.?|inr|rupees?|only)(?![a-z])/g, "")
    .replace(/[,\s]/g, "");
  const m = /^(\d+(?:\.\d+)?)([a-z]*)$/.exec(text);
  if (!m) return null;
  const unit = m[2] ? UNITS[m[2]] : 1;
  if (!unit) return null;
  // Whole paise: "7.42 L" is 742000, not 741999.9999999999.
  return Math.round(Number(m[1]) * unit * 100) / 100;
}

/**
 * EMD cell text. GeM sheets write "Advisory Bank: SBI | EMD Amount: 80000";
 * only the amount is taken. A bank alone or "EXEMPTION-BIS" is not an amount.
 */
export function parseEmd(input: unknown): number | null {
  const amount = typeof input === "string" ? /EMD Amount:(.*)$/i.exec(input)?.[1] : undefined;
  return parseRupees(amount ?? input);
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "₹12,34,567" for display; null for 0 or no amount, which mean the same. */
export function formatRupees(input: unknown): string | null {
  const n = parseRupees(input);
  return n ? INR.format(n) : null;
}
