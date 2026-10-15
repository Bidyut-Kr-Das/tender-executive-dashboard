import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PerformanceCertificateModel } from "@/generated/prisma/models/PerformanceCertificate";
import {
  getPerformanceCertificates,
  getSupplyPartyNames,
  getUtilityPartyNames,
  updatePerformanceCertificatePartyName as updatePartyNameAction,
  updatePerformanceCertificateField as updateFieldAction,
  type PerformanceCertificateField,
} from "@/actions/performanceCertificates";

export type PerformanceCertificateRow = PerformanceCertificateModel &
  Record<string, unknown>;

interface PerformanceCertificatesState {
  rows: PerformanceCertificateRow[];
  partyNames: string[];
  utilityNames: string[];
  saving: Record<string, boolean>;
  loading: boolean;
  error: string | null;
}

const initialState: PerformanceCertificatesState = {
  rows: [],
  partyNames: [],
  utilityNames: [],
  saving: {},
  loading: false,
  error: null,
};

export const fetchPerformanceCertificates = createAsyncThunk(
  "performanceCertificates/fetchAll",
  async () => await getPerformanceCertificates(),
);

export const fetchSupplyPartyNames = createAsyncThunk(
  "performanceCertificates/fetchPartyNames",
  async () => await getSupplyPartyNames(),
);

export const fetchUtilityPartyNames = createAsyncThunk(
  "performanceCertificates/fetchUtilityNames",
  async () => await getUtilityPartyNames(),
);

export const updatePerformanceCertificatePartyName = createAsyncThunk(
  "performanceCertificates/updatePartyName",
  async (params: { id: string; partyName: string | null }) => {
    await updatePartyNameAction(params.id, params.partyName);
    return params;
  },
);

export const updatePerformanceCertificateField = createAsyncThunk(
  "performanceCertificates/updateField",
  async (params: {
    id: string;
    field: PerformanceCertificateField;
    value: string | null;
  }) => {
    await updateFieldAction(params.id, params.field, params.value);
    return params;
  },
);

export const performanceCertificatesSlice = createSlice({
  name: "performanceCertificates",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPerformanceCertificates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPerformanceCertificates.fulfilled, (state, action) => {
        state.rows = action.payload;
        state.loading = false;
      })
      .addCase(fetchPerformanceCertificates.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message ?? "Failed to load performance certificates";
      })
      .addCase(fetchSupplyPartyNames.fulfilled, (state, action) => {
        state.partyNames = action.payload;
      })
      .addCase(fetchUtilityPartyNames.fulfilled, (state, action) => {
        state.utilityNames = action.payload;
      })
      .addCase(updatePerformanceCertificatePartyName.fulfilled, (state, action) => {
        const { id, partyName } = action.payload;
        state.rows = state.rows.map((r) =>
          r.id === id ? { ...r, partyName } : r,
        );
      })
      .addCase(updatePerformanceCertificateField.pending, (state, action) => {
        const { id, field } = action.meta.arg;
        state.saving[`${id}-${field}`] = true;
      })
      .addCase(updatePerformanceCertificateField.fulfilled, (state, action) => {
        const { id, field, value } = action.payload;
        state.rows = state.rows.map((r) =>
          r.id === id ? { ...r, [field]: value } : r,
        );
        delete state.saving[`${id}-${field}`];
      })
      .addCase(updatePerformanceCertificateField.rejected, (state, action) => {
        const { id, field } = action.meta.arg;
        delete state.saving[`${id}-${field}`];
      });
  },
});

export default performanceCertificatesSlice.reducer;
