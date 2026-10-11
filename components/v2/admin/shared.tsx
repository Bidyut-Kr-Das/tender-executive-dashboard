"use client";

import { useCallback, useEffect, useState } from "react";
import { describeError } from "@/components/v2/ui/errors";

/** JSON request to one of the admin routes; a refusal throws the server's message. */
export async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || "Request failed");
  return data as T;
}

/**
 * The rows of an admin list, loaded once. A save or delete patches them here
 * with `upsert` and `remove`, so the list is never fetched again after an edit.
 * `load` must be a stable function.
 */
export function useRows<T extends { id: number }>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await load());
      setError(null);
    } catch (err) {
      setError(await describeError(err));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  const upsert = useCallback((...saved: T[]) => {
    setRows((prev) => {
      const next = [...prev];
      for (const row of saved) {
        const at = next.findIndex((r) => r.id === row.id);
        if (at === -1) next.push(row);
        else next[at] = row;
      }
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { rows, loading, error, reload, upsert, remove };
}
