import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { RailwaysModel } from "@/generated/prisma/models/Railways";
import { getRailways } from "@/actions/railways";

export type RailwayRow = RailwaysModel & Record<string, unknown>;

interface RailwaysState {
  rows: RailwayRow[];
  loading: boolean;
  error: string | null;
}

const initialState: RailwaysState = {
  rows: [],
  loading: false,
  error: null,
};

export const fetchRailways = createAsyncThunk(
  "railways/fetchAll",
  async () => await getRailways(),
);

export const railwaysSlice = createSlice({
  name: "railways",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRailways.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRailways.fulfilled, (state, action) => {
        state.rows = action.payload;
        state.loading = false;
      })
      .addCase(fetchRailways.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Failed to load railways";
      });
  },
});

export default railwaysSlice.reducer;