export const TENDER_CATEGORIES = {
  MANUFACTURING: "Manufacturing",
  EPC: "EPC",
} as const;

export type TenderCategory =
  (typeof TENDER_CATEGORIES)[keyof typeof TENDER_CATEGORIES];

export const TENDER_SUBCATEGORIES: Record<TenderCategory, readonly string[]> = {
  [TENDER_CATEGORIES.MANUFACTURING]: ["Cables & Conductors"],
  [TENDER_CATEGORIES.EPC]: [
    "Water Distribution",
    "Power Distribution",
    "Power Transmission",
    "Railways",
    "Solar",
  ],
};

// Manufacturing subcategory is optional; EPC requires one from the list.
export function isValidCategorySelection(
  category: unknown,
  subCategory: unknown,
): boolean {
  const options = TENDER_SUBCATEGORIES[category as TenderCategory];
  if (!options) return false;
  if (category === TENDER_CATEGORIES.MANUFACTURING && !subCategory) return true;
  return options.includes(subCategory as string);
}

// User-selected EPC subcategory cannot be trusted, so derive it per tender from
// the brief and organization. Any matching rule overrides the selection; when no
// rule matches, the user's selection is kept as fallback.
export function resolveEpcSubCategory(
  tenderBrief: unknown,
  organization: unknown,
  fallback: string,
): string {
  const brief = String(tenderBrief ?? "").toLowerCase();
  const org = String(organization ?? "").toLowerCase();

  // Ground rules (always win).
  if (org.includes("railway")) return "Railways";
  if (brief.includes("pijf")) return "Railways";

  // Power Transmission.
  if (brief.includes("opgw") && !brief.includes("supply")) {
    return "Power Transmission";
  }
  if (brief.includes("transmission")) return "Power Transmission";

  // Power Distribution.
  if (brief.includes("distribution")) return "Power Distribution";
  if (brief.includes("under") && brief.includes("ground")) {
    return "Power Distribution";
  }

  return fallback;
}
