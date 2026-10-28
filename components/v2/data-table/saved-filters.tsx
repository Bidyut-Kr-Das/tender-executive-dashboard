"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsDeveloper } from "@/components/v2/providers";
import { Bookmark, BookmarkPlus, Globe, Loader2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
  type SavedFilterRow,
} from "@/actions/saved-filters";
import { Button, IconButton } from "@/components/v2/ui/button";
import { Checkbox, Input } from "@/components/v2/ui/field";
import { Popover } from "@/components/v2/ui/overlay";
import { toastError } from "@/components/v2/ui/errors";
import { say } from "@/lib/pip-says";

/*
 * Filters kept per page: global ones every user is offered, set by developers,
 * and each user's own. Stored as formulas, so applying one goes through the
 * same checks as a typed formula.
 */


/** The page's list, owned by the formula bar so a save shows up in the menu. */
interface ListProps {
  list: SavedFilterRow[] | null;
  setList: (list: SavedFilterRow[]) => void;
}

export function SavedFiltersMenu({
  list,
  setList,
  onApply,
}: ListProps & {
  /** Applies a formula; returns why it does not fit this page, if it does not. */
  onApply: (formula: string) => string[];
}) {
  const page = usePathname();
  const isDeveloper = useIsDeveloper();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || list) return;
    listSavedFilters(page).then(setList, (err) => {
      setList([]);
      toastError(say.couldNot("load your saved filters"), err);
    });
  }, [open, list, page, setList]);

  const apply = (f: SavedFilterRow) => {
    const errors = onApply(f.formula);
    if (errors.length) {
      toast.error(say.filterNoLongerFits(f.name), { description: errors.join("\n") });
      return;
    }
    setOpen(false);
  };

  const remove = async (f: SavedFilterRow) => {
    try {
      await deleteSavedFilter(f.id);
      setList((list ?? []).filter((x) => x.id !== f.id));
    } catch (err) {
      toastError(say.couldNot("delete the filter"), err);
    }
  };

  const section = (title: string, rows: SavedFilterRow[], canDelete: boolean) =>
    rows.length > 0 && (
      <section className="flex flex-col">
        <h4 className="type-label px-2 pb-1 pt-1.5 text-ink-3">{title}</h4>
        {rows.map((f) => (
          <div key={f.id} className="flex items-center gap-1 rounded-md hover:bg-hover">
            <button
              type="button"
              title={f.formula}
              onClick={() => apply(f)}
              className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
            >
              {f.global ? (
                <Globe className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              ) : (
                <User className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
            </button>
            {canDelete && (
              <IconButton size="sm" label={`Delete ${f.name}`} onClick={() => remove(f)}>
                <Trash2 className="size-3.5" />
              </IconButton>
            )}
          </div>
        ))}
      </section>
    );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-72"
      trigger={<Button icon={<Bookmark className="size-3.5" />}>Saved</Button>}
    >
      {list === null ? (
        <p className="flex items-center gap-2 px-2 py-1.5 text-ink-3">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading
        </p>
      ) : list.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-ink-3">No saved filters for this page yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {section("Global", list.filter((f) => f.global), isDeveloper)}
          {section("Mine", list.filter((f) => !f.global), true)}
        </div>
      )}
    </Popover>
  );
}

export function SaveFilterButton({
  list,
  setList,
  formula,
}: ListProps & {
  /** The formula to save; empty when there is nothing valid to save. */
  formula: string;
}) {
  const page = usePathname();
  const isDeveloper = useIsDeveloper();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [global, setGlobal] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const row = await createSavedFilter({ page, name, formula, global });
      if (list) setList([...list, row]);
      setOpen(false);
      setName("");
      setGlobal(false);
      toast.success(say.saved(`"${row.name}"`));
    } catch (err) {
      toastError(say.couldNot("save the filter"), err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-72"
      trigger={
        <IconButton label="Save filter" disabled={!formula}>
          <BookmarkPlus className="size-4" />
        </IconButton>
      }
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save();
        }}
      >
        <Input
          aria-label="Filter name"
          autoFocus
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {isDeveloper && (
          <Checkbox checked={global} onChange={setGlobal}>
            <span className="text-xs">Global: offer to every user</span>
          </Checkbox>
        )}
        <div className="flex justify-end">
          <Button size="sm" variant="primary" type="submit" loading={saving} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Popover>
  );
}
