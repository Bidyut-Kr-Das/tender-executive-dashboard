import { fetchAllFilteredTenderRows } from "@/actions/tender-query";
import type { MergedGroup, TenderQuery } from "@/lib/tender-query";
import type { TenderPageAssociation } from "@/lib/slices/tenderPageSlice";

const JSON_LIST_COLUMNS = new Set([
  "itemSchedules",
  "proposedErpItemName",
  "proposedErpQuantity",
  "cva",
]);

// Excel's hard limit for one cell.
const MAX_CELL = 32767;

/**
 * Writes every row the current filters match (not just the visible page) to
 * `tenders-YYYY-MM-DD.xlsx`, one sheet column per visible table column.
 */
export async function exportTenders({
  query,
  columns,
  mergedGroups,
  associations,
}: {
  query: TenderQuery;
  columns: { id: string; header: string }[];
  mergedGroups: MergedGroup[];
  associations: TenderPageAssociation[];
}): Promise<number> {
  // Lazy: the ~400KB writer stays out of the page chunk until someone exports.
  const [XLSX, rows] = await Promise.all([
    import("xlsx"),
    fetchAllFilteredTenderRows(
      query,
      columns.map((c) => c.id),
    ),
  ]);

  const data = rows.map((row) => {
    const source: Record<string, string | undefined> = { ...row };
    // Merged columns are stitched in the browser, so the export must do it too.
    for (const g of mergedGroups) {
      if (g.fields.length < 2) continue;
      source[g.label] = g.separator.trim()
        ? g.fields
            .map((f) => row[f] ?? "")
            .filter(Boolean)
            .join(g.separator)
        : (row[g.fields[0]] ?? "");
    }

    const out: Record<string, string> = {};
    for (const { id, header } of columns) {
      let value = source[id] ?? "";
      if (JSON_LIST_COLUMNS.has(id)) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) value = parsed.map(String).join(" | ");
        } catch {
          // Not JSON: keep the raw text.
        }
      }
      if (id === "assignedTo") {
        value = value
          .split(",")
          .filter(Boolean)
          .map((assocId) => {
            const a = associations.find((x) => x.id === parseInt(assocId));
            return a ? `${a.name}(${a.email})` : "";
          })
          .filter(Boolean)
          .join("\n");
      }
      if ((id === "app" || id === "aps" || id === "apm") && value !== "YES" && value !== "NO") {
        value = "";
      }
      out[header] = value.length > MAX_CELL ? value.slice(0, MAX_CELL) : value;
    }
    return out;
  });

  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Tenders");
  XLSX.writeFile(book, `tenders-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return rows.length;
}
