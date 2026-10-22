import { createSlice } from "@reduxjs/toolkit";

interface FilesState {
  selectedDateFrom: string | null;
  selectedDateTo: string | null;
}

function todayString(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const initialState: FilesState = {
  selectedDateFrom: "2026-01-01T00:00:00.000Z",
  selectedDateTo: todayString(),
};

const filesSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    setSelectedDateRange(state, action) {
      state.selectedDateFrom = action.payload.from;
      state.selectedDateTo = action.payload.to;
    },
    resetSelectedDateRange(state) {
      state.selectedDateFrom = null;
      state.selectedDateTo = null;
    },
    clearState() {
      return initialState;
    },
  },
});

export const { setSelectedDateRange, resetSelectedDateRange, clearState } =
  filesSlice.actions;
export default filesSlice.reducer;
