export const TENDER_CATEGORIES = {
  MANUFACTURING: "Manufacturing",
  EPC: "EPC",
} as const;

export const EPC_SUBCATEGORIES = [
  "Water Distribution",
  "Power Distribution",
  "Power Transmission",
  "Railways",
  "Solar",
] as const;

export type TenderCategory =
  (typeof TENDER_CATEGORIES)[keyof typeof TENDER_CATEGORIES];
export type EpcSubCategory = (typeof EPC_SUBCATEGORIES)[number];

// Manufacturing takes no subcategory; EPC requires one from the list.
export function isValidCategorySelection(
  category: unknown,
  subCategory: unknown,
): boolean {
  if (category === TENDER_CATEGORIES.MANUFACTURING) return !subCategory;
  if (category === TENDER_CATEGORIES.EPC) {
    return EPC_SUBCATEGORIES.includes(subCategory as EpcSubCategory);
  }
  return false;
}
