import type { DataTableColumn } from "./types";
import { cellText } from "./use-client-table";

// Excel's hard limit for one cell.
const MAX_CELL = 32767;

/**
 * Writes rows to a spreadsheet, one sheet column per table column, using each
 * column's `text`. The file name's extension picks the format (.xlsx or .csv).
 */
export async function exportRows<Row>(
  rows: Row[],
  columns: DataTableColumn<Row>[],
  fileName: string,
  sheetName: string,
): Promise<number> {
  // Lazy: the ~400KB writer stays out of the page chunk until someone exports.
  const XLSX = await import("xlsx");
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((c) => [c.header, cellText(c, row).slice(0, MAX_CELL)])),
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.header) }),
    sheetName,
  );
  XLSX.writeFile(book, fileName);
  return rows.length;
}
