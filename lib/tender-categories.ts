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
