import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export type BomOption = {
  itemName: string | null;
  bomId: string;
  bomType: string | null;
  itemCode: string;
  itemScheduleName: string;
};

export type BomByItemName = Record<string, BomOption[]>;

interface UtilityState {
  bomByItemName: BomByItemName;
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

const initialState: UtilityState = {
  bomByItemName: {},
  loading: false,
  error: null,
  loaded: false,
};

// convenience to fetch all (no filter)
export const fetchAllBomOptions = createAsyncThunk(
  "utility/fetchAllBomOptions",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch("/api/bom-options");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to fetch all bom options (${res.status})`);
      }
      const data = (await res.json()) as { bomByItemName: BomByItemName };
      return data.bomByItemName;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "Failed to fetch all bom options");
    }
  }
);

const utilitySlice = createSlice({
  name: "utility",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllBomOptions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllBomOptions.fulfilled, (state, action) => {
        state.loading = false;
        state.bomByItemName = action.payload as BomByItemName;
        state.loaded = true;
      })
      .addCase(fetchAllBomOptions.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? action.error.message ?? "Failed to fetch";
      });
  },
});

export default utilitySlice.reducer;
