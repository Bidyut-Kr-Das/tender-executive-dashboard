import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PerformanceCertificateModel } from "@/generated/prisma/models/PerformanceCertificate";
import { getPerformanceCertificates } from "@/actions/performanceCertificates";

export type PerformanceCertificateRow = PerformanceCertificateModel &
  Record<string, unknown>;

interface PerformanceCertificatesState {
  rows: PerformanceCertificateRow[];
  loading: boolean;
  error: string | null;
}

const initialState: PerformanceCertificatesState = {
  rows: [],
  loading: false,
  error: null,
};

export const fetchPerformanceCertificates = createAsyncThunk(
  "performanceCertificates/fetchAll",
  async () => await getPerformanceCertificates(),
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
        state.error = action.error.message ?? "Failed to load performance certificates";
      });
  },
});

export default performanceCertificatesSlice.reducer;
