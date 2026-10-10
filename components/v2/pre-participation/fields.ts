import type { ReverseAuctionWebhookData } from "@/lib/integrations/n8n";
import type { AppDispatch } from "@/lib/store";
import type { FlatRow } from "@/lib/tender-flatten";
import type { TenderPageAssociation } from "@/lib/slices/tenderPageSlice";
import {
  triggerReverseAuctionWebhook,
  updateTenderBeneficiaryBankDetails,
  updateTenderCell,
  updateTenderDocketNo,
  updateTenderMergedField,
  updateTenderReason,
  updateTenderStatusAndAction,
} from "@/lib/slices/tendersSlice";

export type Row = FlatRow;

export interface SaveContext {
  dispatch: AppDispatch;
  associations: TenderPageAssociation[];
}

export type FieldSection =
  | "General"
  | "EMD and BG"
  | "Participation"
  | "Reverse auction"
  | "Eligibility and terms";

/**
 * One editable tender field: how it is shown, what it may hold and which thunk
 * saves it. The table cell and the docket sheet both render from this, so an
 * edit rule exists once.
 */
export interface FieldDef {
  /** Flat row key. */
  id: string;
  label: string;
  kind: "text" | "textarea" | "select" | "yesNo" | "dateTime";
  /** `select` choices. */
  options?: { value: string; label: string }[];
  /** `select` only: no blank choice. */
  required?: boolean;
  /** `yesNo` stored values. */
  tokens?: { yes: string; no: string; none: string };
  section: FieldSection;
  /** Current value when it is not simply `row[id]`. */
  value?: (row: Row) => string;
  /** A message when this value must not be saved. */
  validate?: (value: string) => string | null;
  /** A message when the field cannot be edited on this row. */
  locked?: (row: Row) => string | null;
  save: (ctx: SaveContext, row: Row, value: string) => Promise<unknown>;
}

/** Same key the server pages by: the docket, or the row when it has none. */
export const docketKey = (row: Row): string =>
  (row.docketNo ?? "").trim().toUpperCase() || `__row_${row.id}`;

export const fieldValue = (field: FieldDef, row: Row): string =>
  field.value ? field.value(row) : (row[field.id] ?? "");

/** A non-empty RA qualification rule forces reverse auction to yes. */
export function raValue(row: Row): boolean | null {
  if ((row.raQualificationRule ?? "").trim()) return true;
  if (row.reverseAuctionApplicable === "true") return true;
  if (row.reverseAuctionApplicable === "false") return false;
  return null;
}

function raWebhookData(
  row: Row,
  associations: TenderPageAssociation[],
  patch: Partial<ReverseAuctionWebhookData>,
): ReverseAuctionWebhookData {
  const ids = (row.assignedTo ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  const first = associations.find((a) => ids.includes(a.id));
  return {
    tenderMergedId: Number(row.id),
    organization: row.organization || null,
    docketNo: row.docketNo || null,
    referenceNo: row.referenceNo || null,
    reverseAuctionApplicable: raValue(row),
    reverseAuctionStartDate: row.reverseAuctionStartDate || null,
    reverseAuctionEndDate: row.reverseAuctionEndDate || null,
    associateName: first?.name ?? null,
    associateEmail: first?.email ?? null,
    ...patch,
  };
}

const merged =
  (field: string): FieldDef["save"] =>
  ({ dispatch }, row, value) =>
    dispatch(
      updateTenderMergedField({
        rowIndex: 0,
        field,
        value,
        tenderMergedId: Number(row.id),
        oldValue: row[field] ?? "",
      }),
    ).unwrap();

const decision =
  (field: "participated" | "catalogueDone"): FieldDef["save"] =>
  ({ dispatch }, row, value) =>
    dispatch(
      updateTenderCell({
        rowIndex: 0,
        field,
        value,
        tenderMergedId: Number(row.id),
        oldValue: row[field] ?? "",
      }),
    ).unwrap();

/** Status, next action and RA are written together by one server action. */
const statusAndAction = (
  { dispatch }: SaveContext,
  row: Row,
  patch: { tenderUpdateStatus?: string; reverseAuctionApplicable?: boolean | null },
) =>
  dispatch(
    updateTenderStatusAndAction({
      tenderMergedId: Number(row.id),
      tenderUpdateStatus: row.tenderUpdateStatus || "OPEN",
      nextAction: row.nextAction || null,
      reverseAuctionApplicable: raValue(row),
      ...patch,
    }),
  ).unwrap();

const raDate =
  (field: "reverseAuctionStartDate" | "reverseAuctionEndDate"): FieldDef["save"] =>
  (ctx, row, value) =>
    merged(field)(ctx, row, value).then(() => {
      ctx.dispatch(
        triggerReverseAuctionWebhook(
          raWebhookData(row, ctx.associations, { [field]: value || null }),
        ),
      );
    });

const DOCKET_PATTERN = /^ENQ-\d+-(?:(\d{4})-\1|\d{2}-\d{2})$/i;

const text = (id: string, label: string, section: FieldSection): FieldDef => ({
  id,
  label,
  kind: "text",
  section,
  save: merged(id),
});

const options = (...values: string[]) => values.map((v) => ({ value: v, label: v }));

const FIELD_LIST: FieldDef[] = [
  {
    id: "docketNo",
    label: "Docket No",
    kind: "text",
    section: "General",
    validate: (value) =>
      value === "" || DOCKET_PATTERN.test(value)
        ? null
        : "Use ENQ-<number>-<yyyy>-<yyyy> or ENQ-<number>-<yy>-<yy>",
    save: ({ dispatch }, row, value) =>
      dispatch(
        updateTenderDocketNo({
          tenderMergedId: Number(row.id),
          docketNo: value,
          oldDocketNo: row.docketNo ?? "",
        }),
      ).unwrap(),
  },
  text("applicableIndex", "Applicable index", "General"),
  text("contractNo", "Contract number", "General"),
  text("miiPurchasePreference", "MII purchase preference", "General"),
  text("location", "Location", "General"),

  {
    id: "emdPaymentMode",
    label: "EMD payment mode",
    kind: "select",
    options: options("Draft", "Bank Guarantee", "Online", "NO"),
    section: "EMD and BG",
    save: merged("emdPaymentMode"),
  },
  text("emd", "EMD", "EMD and BG"),
  text("documentFees", "Document fees", "EMD and BG"),
  text("bgDate", "BG date", "EMD and BG"),
  text("bgExpiryDate", "BG expiry date", "EMD and BG"),
  text("claimDate", "Claim date", "EMD and BG"),
  {
    id: "bgStatus",
    label: "BG status",
    kind: "select",
    options: options("PENDING", "TO BE FOLLOWED UP", "RETURNED"),
    section: "EMD and BG",
    save: merged("bgStatus"),
  },
  {
    id: "beneficiaryBankDetails",
    label: "Beneficiary bank details",
    kind: "text",
    section: "EMD and BG",
    save: ({ dispatch }, row, value) =>
      dispatch(
        updateTenderBeneficiaryBankDetails({
          tenderMergedId: Number(row.id),
          beneficiaryBankDetails: value,
          oldBeneficiaryBankDetails: row.beneficiaryBankDetails ?? "",
        }),
      ).unwrap(),
  },
  text("ePbgDurationMonths", "e-PBG duration (months)", "EMD and BG"),
  text("ePbgPercentage", "e-PBG percentage", "EMD and BG"),

  {
    id: "participated",
    label: "Participated",
    kind: "yesNo",
    tokens: { yes: "true", no: "false", none: "null" },
    section: "Participation",
    save: decision("participated"),
  },
  {
    id: "catalogueDone",
    label: "Catalogue done",
    kind: "yesNo",
    tokens: { yes: "YES", no: "NO", none: "NOT_DECIDED" },
    section: "Participation",
    save: decision("catalogueDone"),
  },
  {
    id: "tenderUpdateStatus",
    label: "Tender update status",
    kind: "select",
    options: [
      { value: "OPEN", label: "Open" },
      { value: "CLOSED", label: "Closed" },
    ],
    required: true,
    section: "Participation",
    value: (row) => row.tenderUpdateStatus || "OPEN",
    save: (ctx, row, value) =>
      statusAndAction(ctx, row, { tenderUpdateStatus: value || "OPEN" }),
  },
  {
    id: "reason",
    label: "Reason for not participated",
    kind: "textarea",
    section: "Participation",
    save: ({ dispatch }, row, value) =>
      dispatch(
        updateTenderReason({
          tenderMergedId: Number(row.id),
          reason: value,
          oldReason: row.reason ?? "",
        }),
      ).unwrap(),
  },

  {
    id: "reverseAuctionApplicable",
    label: "Reverse auction",
    kind: "yesNo",
    tokens: { yes: "true", no: "false", none: "" },
    section: "Reverse auction",
    value: (row) => {
      const ra = raValue(row);
      return ra === null ? "" : String(ra);
    },
    locked: (row) =>
      (row.raQualificationRule ?? "").trim()
        ? "Set by the RA qualification rule"
        : null,
    save: (ctx, row, value) => {
      const ra = value === "" ? null : value === "true";
      return statusAndAction(ctx, row, { reverseAuctionApplicable: ra }).then(() => {
        ctx.dispatch(
          triggerReverseAuctionWebhook(
            raWebhookData(row, ctx.associations, { reverseAuctionApplicable: ra }),
          ),
        );
      });
    },
  },
  {
    id: "reverseAuctionStartDate",
    label: "RA start",
    kind: "dateTime",
    section: "Reverse auction",
    save: raDate("reverseAuctionStartDate"),
  },
  {
    id: "reverseAuctionEndDate",
    label: "RA end",
    kind: "dateTime",
    section: "Reverse auction",
    save: raDate("reverseAuctionEndDate"),
  },
  text("raQualificationRule", "RA qualification rule", "Reverse auction"),

  text("startupExemption", "Startup exemption", "Eligibility and terms"),
  text("minimumAverageAnnualTurnover", "Minimum avg annual turnover", "Eligibility and terms"),
  text("oemAverageTurnover", "OEM average turnover", "Eligibility and terms"),
  text("yearsOfPastExperience", "Years of past experience", "Eligibility and terms"),
  text("pastPerformance", "Past performance", "Eligibility and terms"),
  text("msmeExemption", "MSME exemption", "Eligibility and terms"),
  text("msePurchasePreference", "MSE purchase preference", "Eligibility and terms"),
  text("contractPeriod", "Contract period", "Eligibility and terms"),
  text("bidOfferValidity", "Bid offer validity", "Eligibility and terms"),
  text("typeOfBid", "Type of bid", "Eligibility and terms"),
  text("documentRequiredFromSeller", "Document required from seller", "Eligibility and terms"),
  text(
    "technicalClarificationTimeAllowed",
    "Technical clarification time allowed",
    "Eligibility and terms",
  ),
  text("mediationClause", "Mediation clause", "Eligibility and terms"),
  text("arbitrationClause", "Arbitration clause", "Eligibility and terms"),
];

export const FIELDS: Record<string, FieldDef> = Object.fromEntries(
  FIELD_LIST.map((f) => [f.id, f]),
);

export const FIELD_SECTIONS: { title: FieldSection; fields: FieldDef[] }[] = (
  [
    "General",
    "EMD and BG",
    "Participation",
    "Reverse auction",
    "Eligibility and terms",
  ] as const
).map((title) => ({ title, fields: FIELD_LIST.filter((f) => f.section === title) }));
