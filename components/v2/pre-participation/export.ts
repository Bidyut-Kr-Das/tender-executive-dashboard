import { fetchAllFilteredTenderRows } from "@/actions/tender-query";
import type { TenderQuery } from "@/lib/tender-query";
import type { DataTableColumn } from "@/components/v2/data-table/types";
import type { Row } from "./fields";

// Excel's hard limit for one cell.
const MAX_CELL = 32767;

/**
 * Writes every tender the current filters match (not just the visible page) to
 * `pre-participation-YYYY-MM-DD.xlsx`, one sheet column per visible table column.
 */
export async function exportPreParticipation(
  query: TenderQuery,
  columns: DataTableColumn<Row>[],
): Promise<number> {
  // Lazy: the ~400KB writer stays out of the page chunk until someone exports.
  const [XLSX, rows] = await Promise.all([
    import("xlsx"),
    fetchAllFilteredTenderRows(query, null),
  ]);

  const data = rows.map((row) =>
    Object.fromEntries(
      columns.map((c) => [
        c.header,
        (c.text ? c.text(row) : (row[c.id] ?? "")).slice(0, MAX_CELL),
      ]),
    ),
  );

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), "Pre participation");
  XLSX.writeFile(book, `pre-participation-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return rows.length;
}
