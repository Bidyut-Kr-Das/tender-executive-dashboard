import { isBeforeTodayIST } from "@/lib/format-ist";
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
import { FIELDS, NEXT_ACTIONS, fieldValue, type ParticipationScope, type Row } from "./fields";

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

// v1's column sets. Post participation and not participated add the result
// columns and drop the pre-participation ones.
const NOT_PARTICIPATED_ONLY = new Set([
  "bgNoUtrNo",
  "issuingBank",
  "currentStatus",
  "expectedRaDate",
  "quotationNo",
  "competitors",
  "ourRank",
  "ourValue",
  "nameOfRank1",
  "valueOfRank1",
  "nameOfRank2",
  "valueOfRank2",
  "nextAction",
  "remarks",
]);
const NOT_PARTICIPATED_DROPPED = new Set([
  "publishedDate",
  "assignedDate",
  "typetest",
  "claimDate",
  "beneficiaryBankDetails",
  "statusCategory",
  "apm",
  "catalogueDone",
  "officeName",
  "miiPurchasePreference",
  "tenderFileUrl",
  "reportings",
  "website",
  "raQualificationRule",
  "startupExemption",
  "minimumAverageAnnualTurnover",
  "yearsOfPastExperience",
  "ePbgDurationMonths",
]);

const POST_DROPPED = new Set([...NOT_PARTICIPATED_DROPPED, "reason"]);

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

/** Shown as it is; found through the header's text search. */
const longText = (id: string, header: string): Column => ({ id, header, width: 250 });

/**
 * The columns of one participation page: what each shows, how it filters and
 * which control edits it. Ids are flat row keys, as on the tenders page.
 */
export function buildPreParticipationColumns(
  associations: TenderPageAssociation[],
  scope: ParticipationScope = "home",
  developer = false,
): Column[] {
  const notParticipated = scope === "notParticipated";
  const names = (row: Row) =>
    (row.assignedTo ?? "")
      .split(",")
      .map((id) => associations.find((a) => a.id === Number(id))?.name)
      .filter(Boolean)
      .join(", ");

  // Filled below, once the page's column set is known. Every registry field
  // with a column is edited in that column, so the docket sheet edits those only.
  const shown = new Set<string>();

  const columns: Column[] = [
    {
      id: "docketNo",
      header: "Docket No",
      width: 190,
      frozen: true,
      spanGroup: true,
      filter: selectFilter(),
      cell: (row) => <DocketCell row={row} columns={shown} />,
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
          <Clamp className="break-all font-mono text-xs tabular-nums">{row.referenceNo}</Clamp>
        ) : (
          <Dash />
        ),
    },
    dateColumn("deadline", "Last Date of Submission", {
      width: 190,
      filter: { type: "dateRange", presets: DEADLINE_PRESETS },
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <DateCell value={row.deadline} />
          {notParticipated && isBeforeTodayIST(row.deadline) && (
            <Badge tone="bad">Deadline over</Badge>
          )}
        </div>
      ),
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
    readOnly("bgNoUtrNo", "BG / UTR No"),
    editable("bgStatus", "BG Status", 190, { search: false }),
    editable("beneficiaryBankDetails", "Beneficiary Bank Details", 220),
    readOnly("issuingBank", "Issuing Bank"),
    editable("currentStatus", "Current Status", 200, { search: false }),
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
    editable("expectedRaDate", "Expected RA Date", 170, { search: false }),
    readOnly("quotationNo", "Quotation No"),
    editable("contractNo", "Contract Number"),
    longText("competitors", "Competitors"),
    editable("ourRank", "Our Rank", 130),
    editable("ourValue", "Our Value"),
    editable("nameOfRank1", "L1 Party Name", 200),
    editable("valueOfRank1", "L1 Price"),
    readOnly("differenceBetweenRank1", "L1 Diff (%)", 130),
    editable("nameOfRank2", "L2 Party Name", 200),
    editable("valueOfRank2", "L2 Price"),
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
    editable("nextAction", "Next Action", 230, {
      search: false,
      filter: { type: "select", options: NEXT_ACTIONS },
    }),
    // Found through the header's text search, like the other long text.
    editable("remarks", "Remarks", 250, { filter: undefined }),
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
      // As in v1, only pre participation shows the answer; developers always get it.
      hidden: scope !== "home" && !developer,
      // Pre participation holds undecided tenders only; post participation the
      // ones answered yes; not participated the ones answered no and the
      // undecided ones past their deadline.
      filter:
        scope === "postParticipation"
          ? selectFilter({ value: "true", label: "Yes" })
          : notParticipated
            ? selectFilter({ value: "false", label: "No" })
            : undefined,
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

  const left =
    scope === "home"
      ? NOT_PARTICIPATED_ONLY
      : notParticipated
        ? NOT_PARTICIPATED_DROPPED
        : POST_DROPPED;
  const kept = columns.filter((c) => !left.has(c.id));
  for (const c of kept) if (!c.hidden) shown.add(c.id);
  return kept;
}
