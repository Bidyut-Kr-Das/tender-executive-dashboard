import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  updateTenderDecision,
  updateTenderAssignmentsAction,
  updateTenderUtilityMapping,
  bulkAssignUtilityMappingAction,
  updateDocketNumber,
  updateRemarks,
  updateReason,
  updateStatusAndAction,
  triggerReverseAuctionMail,
  updateReasonForNotAPM,
  updateTenderMergedStringField,
  updateTenderMergedDateField,
  updateTenderMergedBooleanField,
  updateBeneficiaryBankDetails,
} from "@/actions/tender";
import type { ReverseAuctionWebhookData } from "@/lib/integrations/n8n";
import type { TenderMergedMinAggregateOutputType } from "@/generated/prisma/models/TenderMerged";

type StringifyFields<T> = { [K in keyof T]: string };

export type TenderMergedRow =
  & Partial<StringifyFields<TenderMergedMinAggregateOutputType>>
  & {
    type: string;
    id: string;
    tenderFiles?: string;
    reportings?: string;
    evaluations?: string;
    aiFeedbackCorrected?: string;
    aiFeedbackReason?: string;
    fileId?: string;
    [key: string]: string | undefined;
  };

export interface TenderData {
  fileName: string;
  columns: string[];
  rows: TenderMergedRow[];
  associations: { id: number; name: string; email: string }[];
  totalGem: number;
  totalNonGem: number;
}

interface TendersState {
  data: TenderData | null;
  updatingCells: Record<string, boolean>;
  feedbackSaving: Record<string, boolean>;
}

const initialState: TendersState = {
  data: null,
  updatingCells: {},
  feedbackSaving: {},
};

export const updateTenderAssignments = createAsyncThunk(
  "tenders/updateAssignments",
  async (params: {
    rowIndex: number;
    tenderMergedId: number;
    associationIds: number[];
    oldValue: string;
  }) => {
    await updateTenderAssignmentsAction({
      tenderMergedId: params.tenderMergedId,
      associationIds: params.associationIds,
    });
  },
);

export const uploadTenderDocument = createAsyncThunk(
  "tenders/uploadTenderDocument",
  async (params: { tenderMergedId: number; file: File; fileType: string }) => {
    const formData = new FormData();
    formData.append("file", params.file);
    formData.append("fileType", params.fileType);
    const res = await fetch(
      `/api/executive-tenders/${params.tenderMergedId}/document`,
      {
        method: "POST",
        body: formData,
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return {
      tenderMergedId: params.tenderMergedId,
      url: data.url as string,
      fileType: data.fileType as string,
      id: data.id as number,
      name: data.name as string,
      extension: data.extension as string,
      source: data.source as string,
      tags: data.tags as string[],
    };
  },
);

export const updateWebsiteMapping = createAsyncThunk(
  "tenders/updateWebsiteMapping",
  async (params: {
    tenderMergedId: number;
    website: string;
    oldValue: string;
  }) => {
    const result = await updateTenderUtilityMapping({
      tenderMergedId: params.tenderMergedId,
      website: params.website,
    });
    return { ...result, tenderMergedId: params.tenderMergedId };
  },
);

export const bulkAssignUtilityMapping = createAsyncThunk(
  "tenders/bulkAssignUtilityMapping",
  async (params: {
    organization: string;
    website: string;
    utilityMappingId: number;
    excludeTenderMergedId: number;
  }) => {
    const result = await bulkAssignUtilityMappingAction(params);
    return result;
  },
);

export const updateTenderMergedField = createAsyncThunk(
  "tenders/updateMergedField",
  async (params: {
    rowIndex: number;
    field: string;
    value: string;
    tenderMergedId: number;
    oldValue: string;
  }) => {
    let diffs: {
      diffPercentFromL1?: number | null;
      diffPercentFromL2?: number | null;
      differenceBetweenRank1?: string | null;
      differenceBetweenRank2?: string | null;
    } | undefined;
    if (params.field === "emdPaymentMode") {
      const result = await updateTenderMergedStringField({
        tenderMergedId: params.tenderMergedId,
        field: params.field,
        value: params.value,
      });
      if (!result.ok) throw new Error(result.error);
      diffs = result;
    } else if (
      params.field === "emdValidity" ||
      params.field === "reverseAuctionDate" ||
      params.field === "reverseAuctionStartDate" ||
      params.field === "reverseAuctionEndDate" ||
      params.field === "tenderOpeningDate"
    ) {
      await updateTenderMergedDateField({
        tenderMergedId: params.tenderMergedId,
        field: params.field,
        value: params.value || null,
      });
    } else if (
      params.field === "bidValidityExpired" ||
      params.field === "participated" ||
      params.field === "reverseAuctionApplicable" ||
      params.field === "diffL1ManuallyEdited" ||
      params.field === "diffL2ManuallyEdited"
    ) {
      await updateTenderMergedBooleanField({
        tenderMergedId: params.tenderMergedId,
        field: params.field,
        value: params.value === "true",
      });
    } else {
      const result = await updateTenderMergedStringField({
        tenderMergedId: params.tenderMergedId,
        field: params.field,
        value: params.value,
      });
      if (!result.ok) throw new Error(result.error);
      diffs = result;
    }
    return { ...params, diffs };
  },
);

export const updateTenderCell = createAsyncThunk(
  "tenders/updateCell",
  async (params: {
    rowIndex: number;
    field: string;
    value: string;
    tenderMergedId: number;
    oldValue: string;
  }) => {
    const result = await updateTenderDecision({
      tenderMergedId: params.tenderMergedId,
      field: params.field as "app" | "aps" | "apm" | "participated" | "catalogueDone",
      value: params.value as "YES" | "NO" | "NOT_DECIDED" | "true" | "false",
    });
    return result;
  },
);

export const updateTenderDocketNo = createAsyncThunk(
  "tenders/updateDocketNo",
  async (
    params: {
      tenderMergedId: number;
      docketNo: string;
      oldDocketNo: string;
    },
    { rejectWithValue },
  ) => {
    try {
      await updateDocketNumber({
        tenderMergedId: params.tenderMergedId,
        docketNo: params.docketNo,
      });
      return params;
    } catch (err: any) {
      return rejectWithValue(
        err?.message || "Failed to update docket number",
      );
    }
  },
);

export const updateTenderRemarks = createAsyncThunk(
  "tenders/updateRemarks",
  async (params: { tenderMergedId: number; remarks: string; oldRemarks: string }) => {
    await updateRemarks({ tenderMergedId: params.tenderMergedId, remarks: params.remarks });
    return params;
  },
);

export const updateTenderBeneficiaryBankDetails = createAsyncThunk(
  "tenders/updateBeneficiaryBankDetails",
  async (params: { tenderMergedId: number; beneficiaryBankDetails: string; oldBeneficiaryBankDetails: string }) => {
    await updateBeneficiaryBankDetails({ tenderMergedId: params.tenderMergedId, beneficiaryBankDetails: params.beneficiaryBankDetails });
    return params;
  },
);

export const updateTenderReason = createAsyncThunk(
  "tenders/updateReason",
  async (params: { tenderMergedId: number; reason: string; oldReason: string }) => {
    await updateReason({ tenderMergedId: params.tenderMergedId, reason: params.reason });
    return params;
  },
);

export const updateTenderStatusAndAction = createAsyncThunk(
  "tenders/updateStatusAndAction",
  async (params: {
    tenderMergedId: number;
    tenderUpdateStatus: string;
    nextAction: string | null;
    reverseAuctionApplicable: boolean | null;
  }) => {
    await updateStatusAndAction({
      tenderMergedId: params.tenderMergedId,
      tenderUpdateStatus: params.tenderUpdateStatus,
      nextAction: params.nextAction,
      reverseAuctionApplicable: params.reverseAuctionApplicable,
    });
    return params;
  },
);

export const triggerReverseAuctionWebhook = createAsyncThunk(
  "tenders/triggerReverseAuctionWebhook",
  async (params: ReverseAuctionWebhookData) => {
    await triggerReverseAuctionMail(params);
    return params;
  },
);

export const updateTenderReasonForNotAPM = createAsyncThunk(
  "tenders/updateReasonForNotAPM",
  async (
    params: { tenderMergedId: number; reasonForNotAPM: string; oldReasonForNotAPM: string },
    { rejectWithValue },
  ) => {
    try {
      await updateReasonForNotAPM({
        tenderMergedId: params.tenderMergedId,
        reasonForNotAPM: params.reasonForNotAPM,
      });
      return params;
    } catch (err: any) {
      return rejectWithValue(err?.message || "Failed to update reasonForNotAPM");
    }
  },
);

export const saveFeedbackAndReanalyze = createAsyncThunk(
  "tenders/saveFeedbackAndReanalyze",
  async (params: {
    tenderMergedId: number;
    tenderType: string;
    briefText: string;
    originalAi: string;
    correctedAi: string;
    feedbackReason: string;
  }) => {
    const res = await fetch("/api/ai-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenderId: params.tenderMergedId,
        tenderType: params.tenderType,
        briefText: params.briefText,
        originalAi: params.originalAi,
        correctedAi: params.correctedAi,
        feedbackReason: params.feedbackReason,
      }),
    });
    if (!res.ok) throw new Error("Failed to save feedback");

    // Feedback is only pushed to the relevance queue. The worker re-analyzes
    // the tender and results come back through /api/webhook/ai-relevance.
    const result = await res.json();
    return {
      tenderMergedId: params.tenderMergedId,
      queued: Boolean(result.queued),
    };
  },
);

const tendersSlice = createSlice({
  name: "tenders",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(updateTenderCell.pending, (state, action) => {
      const { rowIndex, field } = action.meta.arg;
      state.updatingCells[`${rowIndex}-${field}`] = true;
    });
    builder.addCase(updateTenderCell.fulfilled, (state, action) => {
      const { rowIndex, field, value } = action.meta.arg;
      state.updatingCells[`${rowIndex}-${field}`] = false;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex][field] = value;
      }
    });
    builder.addCase(updateTenderCell.rejected, (state, action) => {
      const { rowIndex, field, oldValue } = action.meta.arg;
      state.updatingCells[`${rowIndex}-${field}`] = false;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex][field] = oldValue;
      }
    });
    // updateTenderDocketNo
    builder.addCase(updateTenderDocketNo.pending, (state, action) => {
      const { tenderMergedId } = action.meta.arg;
      state.updatingCells[`${tenderMergedId}-docketNo`] = true;
    });
    builder.addCase(updateTenderDocketNo.fulfilled, (state, action) => {
      const { tenderMergedId, docketNo } = action.meta.arg;
      state.updatingCells[`${tenderMergedId}-docketNo`] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderMergedId);
        if (row) row.docketNo = docketNo;
      }
    });
    builder.addCase(updateTenderDocketNo.rejected, (state, action) => {
      const { tenderMergedId } = action.meta.arg;
      state.updatingCells[`${tenderMergedId}-docketNo`] = false;
    });
    // updateTenderRemarks
    builder.addCase(updateTenderRemarks.pending, (state, action) => {
      state.updatingCells[`${action.meta.arg.tenderMergedId}-remarks`] = true;
    });
    builder.addCase(updateTenderRemarks.fulfilled, (state, action) => {
      const { tenderMergedId, remarks } = action.meta.arg;
      console.log(`[redux] updateTenderRemarks.fulfilled id=${tenderMergedId} remarks="${remarks}"`);
      state.updatingCells[`${tenderMergedId}-remarks`] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderMergedId);
        if (row) row.remarks = remarks;
      }
    });
    builder.addCase(updateTenderRemarks.rejected, (state, action) => {
      console.warn(`[redux] updateTenderRemarks.rejected:`, action.error);
      state.updatingCells[`${action.meta.arg.tenderMergedId}-remarks`] = false;
    });
    // updateTenderBeneficiaryBankDetails
    builder.addCase(updateTenderBeneficiaryBankDetails.pending, (state, action) => {
      state.updatingCells[`${action.meta.arg.tenderMergedId}-beneficiaryBankDetails`] = true;
    });
    builder.addCase(updateTenderBeneficiaryBankDetails.fulfilled, (state, action) => {
      const { tenderMergedId, beneficiaryBankDetails } = action.meta.arg;
      console.log(`[redux] updateTenderBeneficiaryBankDetails.fulfilled id=${tenderMergedId} value="${beneficiaryBankDetails}"`);
      state.updatingCells[`${tenderMergedId}-beneficiaryBankDetails`] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderMergedId);
        if (row) row.beneficiaryBankDetails = beneficiaryBankDetails;
      }
    });
    builder.addCase(updateTenderBeneficiaryBankDetails.rejected, (state, action) => {
      console.warn(`[redux] updateTenderBeneficiaryBankDetails.rejected:`, action.error);
      state.updatingCells[`${action.meta.arg.tenderMergedId}-beneficiaryBankDetails`] = false;
    });
    // updateTenderReason
    builder.addCase(updateTenderReason.pending, (state, action) => {
      state.updatingCells[`${action.meta.arg.tenderMergedId}-reason`] = true;
    });
    builder.addCase(updateTenderReason.fulfilled, (state, action) => {
      const { tenderMergedId, reason } = action.meta.arg;
      state.updatingCells[`${tenderMergedId}-reason`] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderMergedId);
        if (row) row.reason = reason;
      }
    });
    builder.addCase(updateTenderReason.rejected, (state, action) => {
      state.updatingCells[`${action.meta.arg.tenderMergedId}-reason`] = false;
    });
    // updateTenderStatusAndAction
    builder.addCase(updateTenderStatusAndAction.pending, (state, action) => {
      const { tenderMergedId } = action.meta.arg;
      state.updatingCells[`${tenderMergedId}-statusAndAction`] = true;
    });
    builder.addCase(updateTenderStatusAndAction.fulfilled, (state, action) => {
      const { tenderMergedId, tenderUpdateStatus, nextAction, reverseAuctionApplicable } = action.meta.arg;
      state.updatingCells[`${tenderMergedId}-statusAndAction`] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderMergedId);
        if (row) {
          row.tenderUpdateStatus = tenderUpdateStatus;
          row.nextAction = nextAction ?? "";
          row.reverseAuctionApplicable = reverseAuctionApplicable ? "true" : "false";
        }
      }
    });
    builder.addCase(updateTenderStatusAndAction.rejected, (state, action) => {
      console.warn(`[redux] updateTenderStatusAndAction.rejected:`, action.error);
      state.updatingCells[`${action.meta.arg.tenderMergedId}-statusAndAction`] = false;
    });
    builder.addCase(updateTenderAssignments.pending, (state, action) => {
      const { rowIndex, associationIds } = action.meta.arg;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex].assignedTo = associationIds.join(",");
      }
    });
    builder.addCase(updateTenderAssignments.fulfilled, (state, action) => {
      const { rowIndex, associationIds } = action.meta.arg;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex].assignedTo = associationIds.join(",");
      }
    });
    builder.addCase(updateTenderAssignments.rejected, (state, action) => {
      const { rowIndex, oldValue } = action.meta.arg;
      if (state.data?.rows[rowIndex]) {
        state.data.rows[rowIndex].assignedTo = oldValue;
      }
    });
    // updateTenderReasonForNotAPM
    builder.addCase(updateTenderReasonForNotAPM.pending, (state, action) => {
      const key = `${action.meta.arg.tenderMergedId}-reasonForNotAPM`;
      state.updatingCells[key] = true;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === action.meta.arg.tenderMergedId);
        if (row) row.reasonForNotAPM = action.meta.arg.reasonForNotAPM;
      }
    });
    builder.addCase(updateTenderReasonForNotAPM.fulfilled, (state, action) => {
      const key = `${action.meta.arg.tenderMergedId}-reasonForNotAPM`;
      state.updatingCells[key] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === action.meta.arg.tenderMergedId);
        if (row) row.reasonForNotAPM = action.meta.arg.reasonForNotAPM;
      }
    });
    builder.addCase(updateTenderReasonForNotAPM.rejected, (state, action) => {
      const key = `${action.meta.arg.tenderMergedId}-reasonForNotAPM`;
      state.updatingCells[key] = false;
      const oldVal = (action.meta.arg as { oldReasonForNotAPM?: string })?.oldReasonForNotAPM ?? "";
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === action.meta.arg.tenderMergedId);
        if (row) row.reasonForNotAPM = oldVal;
      }
    });
    // updateWebsiteMapping
    builder.addCase(updateWebsiteMapping.pending, (state, action) => {
      const { tenderMergedId, website } = action.meta.arg;
      const key = `${tenderMergedId}-website`;
      state.updatingCells[key] = true;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderMergedId);
        if (row) row.website = website;
      }
    });
    builder.addCase(updateWebsiteMapping.fulfilled, (state, action) => {
      const key = `${action.meta.arg.tenderMergedId}-website`;
      state.updatingCells[key] = false;
    });
    builder.addCase(updateWebsiteMapping.rejected, (state, action) => {
      const { tenderMergedId, oldValue } = action.meta.arg;
      const key = `${tenderMergedId}-website`;
      state.updatingCells[key] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderMergedId);
        if (row) row.website = oldValue;
      }
    });

    // uploadTenderDocument
    builder.addCase(uploadTenderDocument.pending, (state, action) => {
      const key = `${action.meta.arg.tenderMergedId}-tenderDocument`;
      state.updatingCells[key] = true;
    });
    builder.addCase(uploadTenderDocument.fulfilled, (state, action) => {
      const key = `${action.meta.arg.tenderMergedId}-tenderDocument`;
      state.updatingCells[key] = false;
      if (state.data) {
        const row = state.data.rows.find(
          (r) => Number(r.id) === action.meta.arg.tenderMergedId,
        );
        if (row) {
          const files = row.tenderFiles ? JSON.parse(row.tenderFiles) : [];
          const filtered = Array.isArray(files)
            ? files.filter(
                (f: { tags?: string[] }) =>
                  !f.tags?.includes(action.meta.arg.fileType),
              )
            : [];
          filtered.push({
            id: action.payload.id,
            name: action.payload.name,
            extension: action.payload.extension,
            url: action.payload.url,
            source: action.payload.source,
            tags: [action.meta.arg.fileType],
          });
          row.tenderFiles = JSON.stringify(filtered);
        }
      }
    });
    builder.addCase(uploadTenderDocument.rejected, (state, action) => {
      const key = `${action.meta.arg.tenderMergedId}-tenderDocument`;
      state.updatingCells[key] = false;
    });

    // updateTenderMergedField (generic)
    builder.addCase(updateTenderMergedField.pending, (state, action) => {
      const { tenderMergedId, field } = action.meta.arg;
      state.updatingCells[`${tenderMergedId}-${field}`] = true;
    });
    builder.addCase(updateTenderMergedField.fulfilled, (state, action) => {
      const { tenderMergedId, field, value } = action.meta.arg;
      const key = `${tenderMergedId}-${field}`;
      state.updatingCells[key] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderMergedId);
        if (row) {
          row[field] = value;
          if (field === "raQualificationRule") {
            row.reverseAuctionApplicable = value ? "true" : row.reverseAuctionApplicable;
          }
          const diffs = (action.payload as any)?.diffs as
            | {
                diffPercentFromL1?: number | null;
                diffPercentFromL2?: number | null;
                differenceBetweenRank1?: string | null;
                differenceBetweenRank2?: string | null;
              }
            | undefined;
          if (diffs) {
            if (diffs.diffPercentFromL1 !== undefined) {
              row.diffPercentFromL1 = diffs.diffPercentFromL1 == null ? "" : String(diffs.diffPercentFromL1);
            }
            if (diffs.diffPercentFromL2 !== undefined) {
              row.diffPercentFromL2 = diffs.diffPercentFromL2 == null ? "" : String(diffs.diffPercentFromL2);
            }
            if (diffs.differenceBetweenRank1 !== undefined) {
              row.differenceBetweenRank1 = diffs.differenceBetweenRank1 == null ? "" : String(diffs.differenceBetweenRank1);
            }
            if (diffs.differenceBetweenRank2 !== undefined) {
              row.differenceBetweenRank2 = diffs.differenceBetweenRank2 == null ? "" : String(diffs.differenceBetweenRank2);
            }
          }
        }
      }
    });
    builder.addCase(updateTenderMergedField.rejected, (state, action) => {
      const { tenderMergedId, field } = action.meta.arg;
      state.updatingCells[`${tenderMergedId}-${field}`] = false;
    });

    // bulkAssignUtilityMapping
    builder.addCase(bulkAssignUtilityMapping.fulfilled, (state, action) => {
      const { updatedIds } = action.payload;
      if (state.data) {
        for (const id of updatedIds) {
          const row = state.data.rows.find((r) => Number(r.id) === id);
          if (row) row.website = action.meta.arg.website;
        }
      }
    });

    // saveFeedbackAndReanalyze
    builder.addCase(saveFeedbackAndReanalyze.pending, (state, action) => {
      const key = `${action.meta.arg.tenderMergedId}-reanalyze`;
      state.feedbackSaving[key] = true;
    });
    builder.addCase(saveFeedbackAndReanalyze.fulfilled, (state, action) => {
      const { tenderMergedId } = action.payload;
      const { correctedAi, feedbackReason } = action.meta.arg;
      const key = `${tenderMergedId}-reanalyze`;
      state.feedbackSaving[key] = false;
      if (state.data) {
        const row = state.data.rows.find((r) => Number(r.id) === tenderMergedId);
        if (row) {
          row.aiFeedbackCorrected = correctedAi;
          row.aiFeedbackReason = feedbackReason;
        }
      }
    });
    builder.addCase(saveFeedbackAndReanalyze.rejected, (state, action) => {
      const key = `${action.meta.arg.tenderMergedId}-reanalyze`;
      state.feedbackSaving[key] = false;
    });
  },
});

export default tendersSlice.reducer;
