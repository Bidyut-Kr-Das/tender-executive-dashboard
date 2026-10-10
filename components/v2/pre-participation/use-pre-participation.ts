"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { buildCountsQuery } from "@/lib/epc-table-query";
import type { RootState } from "@/lib/store";
import type { TenderQuery } from "@/lib/tender-query";
import type { ColumnFilterState, ColumnFilterType, FilterOption } from "@/lib/types";
import {
  clearScopeFilters,
  clearStale,
  loadParticipationCounts,
  loadTenderFacet,
  loadTenderPage,
  selectTenderQuery,
  setAssociationFilter,
  setErpItemCategory,
  setPage,
  setPageSize,
  setScopeColumnFilter,
  setSort,
  tenderFilterKey,
  tenderQueryKey,
} from "@/lib/slices/tenderPageSlice";
import { fetchAllBomOptions } from "@/lib/slices/utilitySlice";
import type { TenderCellContext } from "@/components/v2/tenders/use-tenders";
import { ERP_CATEGORY_FILTER } from "./columns";

/** This page's slot in the scope-keyed tenderPage slice. */
const SCOPE = "home" as const;

/** What the server sorts by until the user picks a column. */
const DEFAULT_SORT = { column: "deadline", direction: "desc" } as const;

/**
 * All Redux wiring for the pre-participation page. Same slice, thunks and
 * selectors as v1, so the data is loaded and patched exactly the same way.
 */
export function usePreParticipation() {
  const dispatch = useAppDispatch();
  const page = useAppSelector((s) => s.tenderPage.byScope[SCOPE]);
  const bomLoaded = useAppSelector((s) => s.utility.loaded);
  // Local: filtersSlice.columnVisibility belongs to the tenders page.
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  // v2 has no DataLoader; the BOM selects need their options.
  useEffect(() => {
    if (!bomLoaded) dispatch(fetchAllBomOptions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The route's scope owns the deadline rule, so the tenders default is off.
  const query = useAppSelector(
    (s): TenderQuery => selectTenderQuery(s, SCOPE, false),
    (a, b) => tenderQueryKey(a) === tenderQueryKey(b),
  );
  const queryKey = useMemo(() => tenderQueryKey(query), [query]);
  // Per-person counts answer "how many dockets are in this stage", so they
  // ignore the table's filters and never refetch on paging or sorting.
  const countsQuery = useMemo(() => buildCountsQuery(query), [query]);
  const countsKey = useMemo(() => tenderFilterKey(countsQuery), [countsQuery]);

  const hasMetaRef = useRef(false);
  hasMetaRef.current = page.columns.length > 0;

  const reload = useCallback(() => {
    dispatch(loadTenderPage({ scope: SCOPE, query, includeMeta: !hasMetaRef.current }));
    dispatch(loadParticipationCounts({ scope: SCOPE, query: countsQuery }));
  }, [dispatch, query, countsQuery]);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const stableReload = useCallback(() => reloadRef.current(), []);

  useEffect(() => {
    dispatch(loadTenderPage({ scope: SCOPE, query, includeMeta: !hasMetaRef.current }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    dispatch(loadParticipationCounts({ scope: SCOPE, query: countsQuery }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey]);

  // A sync rewrites rows wholesale.
  useEffect(() => {
    if (!page.stale) return;
    dispatch(clearStale({ scope: SCOPE }));
    reloadRef.current();
  }, [page.stale, dispatch]);

  const loadFilterValues = useCallback(
    (columnId: string) => dispatch(loadTenderFacet({ scope: SCOPE, query, column: columnId })),
    [dispatch, query],
  );

  const facetOptions = useMemo(() => {
    const out: Record<string, { options: FilterOption[] | null; loading: boolean }> = {};
    for (const [id, entry] of Object.entries(page.facets)) {
      out[id] = {
        options:
          entry.status === "error" ? null : entry.options.map((v) => ({ value: v, label: v })),
        loading: entry.status === "loading",
      };
    }
    return out;
  }, [page.facets]);

  const getFilterOptions = useCallback(
    (columnId: string) => facetOptions[columnId] ?? NO_OPTIONS,
    [facetOptions],
  );

  const onFilterChange = useCallback(
    (columnId: string, type: ColumnFilterType, value: unknown | undefined) => {
      if (columnId === ERP_CATEGORY_FILTER) {
        // One category at a time: the newest pick replaces the last.
        const category = (value as string[] | undefined)?.at(-1) ?? null;
        dispatch(setErpItemCategory({ scope: SCOPE, category }));
        return;
      }
      // Read at dispatch time: a filter panel can send two changes in one event.
      dispatch((_, getState) => {
        const state = getState() as RootState;
        const next: ColumnFilterState = {
          ...state.tenderPage.byScope[SCOPE].columnFilters[columnId],
          [type]: value,
        };
        if (value === undefined) delete next[type];
        dispatch(
          setScopeColumnFilter({
            scope: SCOPE,
            column: columnId,
            filter: Object.keys(next).length > 0 ? next : null,
          }),
        );
      });
    },
    [dispatch],
  );

  const filters = useMemo(
    () =>
      page.erpItemCategory
        ? { ...page.columnFilters, [ERP_CATEGORY_FILTER]: { select: [page.erpItemCategory] } }
        : page.columnFilters,
    [page.columnFilters, page.erpItemCategory],
  );

  const cellContext = useMemo<TenderCellContext>(
    () => ({ associations: page.associations, canEditRemarks: false, reload: stableReload }),
    [page.associations, stableReload],
  );

  return {
    query,
    rows: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    sort: page.sort ?? DEFAULT_SORT,
    counts: page.participationCounts,
    associations: page.associations,
    associationFilter: page.associationFilter,
    filters,
    columnVisibility,
    onColumnVisibilityChange: setColumnVisibility,
    cellContext,
    /** Nothing to draw yet: the first page has not arrived. */
    initializing: page.columns.length === 0 && page.status !== "error",
    loading: page.status === "loading",
    error: page.status === "error" ? page.error : null,
    reload: stableReload,
    getFilterOptions,
    loadFilterValues,
    onFilterChange,
    onResetFilters: useCallback(() => {
      const associationFilter = page.associationFilter;
      dispatch(clearScopeFilters({ scope: SCOPE }));
      // Column filters only: the assignee has its own chip.
      dispatch(setAssociationFilter({ scope: SCOPE, associationFilter }));
    }, [dispatch, page.associationFilter]),
    onPageChange: useCallback(
      (p: number) => dispatch(setPage({ scope: SCOPE, page: p })),
      [dispatch],
    ),
    onPageSizeChange: useCallback(
      (n: number) => dispatch(setPageSize({ scope: SCOPE, pageSize: n })),
      [dispatch],
    ),
    onSortChange: useCallback(
      (sort: { column: string; direction: "asc" | "desc" }) =>
        dispatch(setSort({ scope: SCOPE, sort })),
      [dispatch],
    ),
    setAssociationFilter: useCallback(
      (value: string | null) =>
        dispatch(setAssociationFilter({ scope: SCOPE, associationFilter: value })),
      [dispatch],
    ),
  };
}

const NO_OPTIONS = { options: null, loading: false } as const;
