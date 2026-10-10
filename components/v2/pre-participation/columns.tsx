import type { TenderPageAssociation } from "@/lib/slices/tenderPageSlice";
import { Chips, Clamp } from "@/components/v2/data-table/cells";
import type { DataTableColumn, FilterOption } from "@/components/v2/data-table/types";
import { Badge, Dash } from "@/components/v2/ui/field";
import {
  PriceCell,
  RawMaterialsCell,
  ReportingsCell,
  WebsiteCell,
} from "@/components/v2/tenders/cells";
import {
  BLANK,
  DEADLINE_PRESETS,
  DateCell,
  parseList,
  rawMaterialsFilter,
  selectFilter,
} from "@/components/v2/tenders/columns";
import {
  ComparativeChartCell,
  ErpItemsCell,
  FieldEditor,
  FileLinkCell,
  FilesCell,
  OfficeCell,
  ReverseAuctionCell,
  TypeTestCell,
  YesNoBadge,
  parseCostingItems,
  parseFiles,
  parseTypeTests,
} from "./cells";
import { DocketCell } from "./docket-sheet";
import { FIELDS, fieldValue, type Row } from "./fields";

type Column = DataTableColumn<Row>;

/** Filter id for the proposed-ERP-item rule sets; not a column of its own. */
export const ERP_CATEGORY_FILTER = "erpItemCategory";

const ERP_CATEGORIES: FilterOption[] = [
  "AB Cable",
  "Conductor",
  "XLPE Cable",
  "PVC Cable",
  "Control Cable",
].map((v) => ({ value: v, label: v }));

const YES_NO: FilterOption[] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const AVAILABILITY = selectFilter(
  { value: "Available", label: "Available" },
  { value: "Not Available", label: "Not available" },
);

/** A select filter with no fixed choices lists the values found in the data. */
export const loadsFilterValues = (column: Column | undefined): boolean =>
  column?.filter?.type === "select" &&
  (column.filter.options ?? []).every((o) => o.value === BLANK.value);

/** A column edited through the field registry. */
const editable = (id: string, header: string, width = 180, extra: Partial<Column> = {}): Column => ({
  id,
  header,
  width,
  filter: selectFilter(),
  text: (row) => fieldValue(FIELDS[id], row),
  cell: (row) => <FieldEditor field={FIELDS[id]} row={row} />,
  ...extra,
});

const readOnly = (id: string, header: string, width = 180): Column => ({
  id,
  header,
  width,
  filter: selectFilter(),
});

const dateColumn = (id: string, header: string, extra: Partial<Column> = {}): Column => ({
  id,
  header,
  width: 160,
  search: false,
  filter: { type: "dateRange" },
  cell: (row) => <DateCell value={row[id]} />,
  ...extra,
});

const list = (id: string, header: string, width: number, splitBy: RegExp): Column => ({
  id,
  header,
  width,
  text: (row) => parseList(row[id], splitBy).join(" | "),
  cell: (row) => <Chips items={parseList(row[id], splitBy)} />,
});

/**
 * The pre-participation page's columns: what each shows, how it filters and
 * which control edits it. Ids are flat row keys, as on the tenders page.
 */
export function buildPreParticipationColumns(associations: TenderPageAssociation[]): Column[] {
  const names = (row: Row) =>
    (row.assignedTo ?? "")
      .split(",")
      .map((id) => associations.find((a) => a.id === Number(id))?.name)
      .filter(Boolean)
      .join(", ");

  return [
    {
      id: "docketNo",
      header: "Docket No",
      width: 190,
      frozen: true,
      spanGroup: true,
      filter: selectFilter(),
      cell: (row) => <DocketCell row={row} />,
    },
    {
      id: "type",
      header: "Tender Type",
      width: 110,
      frozen: true,
      search: false,
      filter: selectFilter(),
      cell: (row) => <Badge tone={row.type === "Gem" ? "accent" : "neutral"}>{row.type}</Badge>,
    },
    {
      id: "referenceNo",
      header: "Tender / NIT No",
      width: 190,
      frozen: true,
      filter: selectFilter(),
      cell: (row) =>
        row.referenceNo ? (
          <span className="break-all font-mono text-xs tabular-nums">{row.referenceNo}</span>
        ) : (
          <Dash />
        ),
    },
    dateColumn("deadline", "Last Date of Submission", {
      width: 190,
      filter: { type: "dateRange", presets: DEADLINE_PRESETS },
    }),
    dateColumn("publishedDate", "Published Date"),
    dateColumn("assignedDate", "Assigned Date"),
    {
      id: "organization",
      header: "Client Name",
      width: 200,
      filter: { type: "select", options: [BLANK], searchAsText: true },
    },
    readOnly("tenderBrief", "Tender Brief", 250),
    list("itemSchedules", "Item Schedule", 220, /\n+/),
    {
      id: "proposedErpItemName",
      header: "Proposed ERP Item Name",
      width: 300,
      extraFilters: [{ id: ERP_CATEGORY_FILTER, label: "Category", options: ERP_CATEGORIES }],
      text: (row) =>
        parseCostingItems(row)
          .map((c) => c.proposedErpItemName)
          .join(" | "),
      cell: (row) => <ErpItemsCell row={row} />,
    },
    list("proposedErpQuantity", "Proposed ERP Quantity", 280, /[\n,;]+/),
    {
      id: "typetest",
      header: "Type Test",
      width: 260,
      text: (row) =>
        parseTypeTests(row)
          .map((t) => `${t.itemCode} - ${t.testCertificateNo}`)
          .join(" | "),
      cell: (row) => <TypeTestCell row={row} />,
    },
    {
      id: "costingFileUrl",
      header: "Costing File",
      width: 150,
      search: false,
      filter: AVAILABILITY,
      cell: (row) => <FileLinkCell href={row.costingFileUrl ?? ""}>Costing</FileLinkCell>,
    },
    {
      id: "tenderFiles",
      header: "Files",
      width: 130,
      sortable: false,
      search: false,
      text: (row) =>
        parseFiles(row)
          .map((f) => f.name)
          .join(" | "),
      cell: (row) => <FilesCell row={row} />,
    },
    {
      id: "boqChart",
      header: "Comparative Chart",
      width: 190,
      sortable: false,
      search: false,
      text: () => "",
      cell: (row) => <ComparativeChartCell row={row} />,
    },
    {
      id: "price",
      header: "Price",
      width: 130,
      search: false,
      filter: selectFilter(
        { value: "FIRM", label: "Firm" },
        { value: "VARIABLE", label: "Variable" },
      ),
      cell: (row) => <PriceCell row={row} />,
    },
    editable("applicableIndex", "Applicable Index"),
    {
      id: "rawMaterials",
      header: "Raw Materials",
      width: 240,
      search: false,
      filter: rawMaterialsFilter,
      cell: (row) => <RawMaterialsCell row={row} />,
    },
    editable("emdPaymentMode", "EMD Payment Mode", 170, { search: false }),
    editable("emd", "EMD"),
    editable("bgDate", "BG Date"),
    editable("bgExpiryDate", "BG Expiry Date"),
    editable("claimDate", "Claim Date"),
    editable("bgStatus", "BG Status", 190, { search: false }),
    editable("beneficiaryBankDetails", "Beneficiary Bank Details", 220),
    readOnly("statusCategory", "Status Category"),
    editable("reason", "Reason for not Participated", 250),
    {
      id: "reverseAuctionApplicable",
      header: "RA",
      width: 110,
      search: false,
      filter: selectFilter(...YES_NO),
      text: (row) => fieldValue(FIELDS.reverseAuctionApplicable, row),
      cell: (row) => <ReverseAuctionCell row={row} />,
    },
    editable("reverseAuctionStartDate", "RA Start", 180, {
      search: false,
      filter: { type: "dateRange" },
    }),
    editable("reverseAuctionEndDate", "RA End", 180, {
      search: false,
      filter: { type: "dateRange" },
    }),
    editable("contractNo", "Contract Number"),
    readOnly("differenceBetweenRank1", "L1 Diff (%)", 130),
    readOnly("differenceBetweenRank2", "L2 Diff (%)", 130),
    editable("tenderUpdateStatus", "Tender Update Status", 170, {
      search: false,
      filter: {
        type: "select",
        options: [
          { value: "OPEN", label: "Open" },
          { value: "CLOSED", label: "Closed" },
        ],
      },
    }),
    list("cva", "CVA", 180, /@/),
    {
      id: "apm",
      header: "Mgmt Dec.",
      width: 110,
      sortable: false,
      search: false,
      cell: (row) =>
        row.apm === "YES" ? <Badge tone="good">Yes</Badge> : <Clamp>{row.apm ?? ""}</Clamp>,
    },
    editable("catalogueDone", "Catalogue Done", 130, {
      search: false,
      filter: selectFilter({ value: "YES", label: "Yes" }, { value: "NO", label: "No" }),
    }),
    {
      id: "assignedTo",
      header: "Prep By",
      width: 180,
      search: false,
      filter: selectFilter(...associations.map((a) => ({ value: String(a.id), label: a.name }))),
      text: names,
    },
    editable("participated", "Participated?", 130, {
      search: false,
      // Every tender on this page is undecided, so there is nothing to filter by.
      filter: undefined,
    }),
    {
      id: "officeName",
      header: "Office Name @ Consignees Reporting Officer",
      width: 240,
      filter: selectFilter(),
      text: (row) =>
        [row.officeName, row.consigneesReportingOfficer].filter(Boolean).join(" @ "),
      cell: (row) => <OfficeCell row={row} />,
    },
    editable("miiPurchasePreference", "MII Purchase Preference"),
    {
      id: "tenderFileUrl",
      header: "Tender Document",
      width: 180,
      search: false,
      filter: AVAILABILITY,
      cell: (row) => <FileLinkCell href={row.tenderFileUrl ?? ""}>Tender document</FileLinkCell>,
    },
    {
      id: "reportings",
      header: "Reporting Officers",
      width: 300,
      sortable: false,
      search: false,
      cell: (row) => <ReportingsCell row={row} />,
    },
    {
      id: "website",
      header: "Website",
      width: 200,
      filter: AVAILABILITY,
      cell: (row) => <WebsiteCell row={row} />,
    },
    editable("raQualificationRule", "RA Qualification Rule"),
    editable("startupExemption", "Startup Exemption"),
    editable("minimumAverageAnnualTurnover", "Minimum Avg Annual Turnover"),
    editable("yearsOfPastExperience", "Years of Past Experience"),
    editable("ePbgDurationMonths", "e-PBG Duration (Months)"),
    editable("documentFees", "Document Fees"),
    editable("contractPeriod", "Contract Period"),
    editable("bidOfferValidity", "Bid Offer Validity"),
    {
      id: "bidValidityExpired",
      header: "Bid Validity Expired",
      width: 160,
      search: false,
      filter: selectFilter(...YES_NO),
      cell: (row) => <YesNoBadge value={row.bidValidityExpired} />,
    },
    editable("location", "Location", 200),
    editable("documentRequiredFromSeller", "Document Required From Seller", 260),
    editable("pastPerformance", "Past Performance", 220),
    editable("typeOfBid", "Type of Bid"),
    editable("technicalClarificationTimeAllowed", "Technical Clarification Time Allowed", 220),
    editable("mediationClause", "Mediation Clause", 200),
    editable("arbitrationClause", "Arbitration Clause", 200),
    editable("oemAverageTurnover", "OEM Average Turnover", 200),
    editable("ePbgPercentage", "e-PBG Percentage", 160),
    editable("msmeExemption", "MSME Exemption"),
    editable("msePurchasePreference", "MSE Purchase Preference", 200),
  ];
}
