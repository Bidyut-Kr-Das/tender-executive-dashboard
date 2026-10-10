"use client";

import { useState, type ReactNode } from "react";
import { PanelRight } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import { formatDateISTLong } from "@/lib/format-ist";
import { cn } from "@/lib/utils";
import { Button } from "@/components/v2/ui/button";
import { Choice, Dash } from "@/components/v2/ui/field";
import { Sheet } from "@/components/v2/ui/sheet";
import { PriceCell, WebsiteCell } from "@/components/v2/tenders/cells";
import { useTenderCellContext } from "@/components/v2/tenders/use-tenders";
import { ErpItemsCell, FieldEditor, OfficeCell } from "./cells";
import { FIELDS, FIELD_SECTIONS, docketKey, type Row } from "./fields";

/** A label over a control. Not a `<label>`: these controls are button groups and menus. */
function Labelled({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", wide && "col-span-2")}>
      <span className="type-label text-ink-3">{label}</span>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-label text-ink-3">{label}</dt>
      <dd className="wrap-break-word tabular-nums">{value || <Dash />}</dd>
    </div>
  );
}

const date = (value: string | undefined) => (value ? formatDateISTLong(value) : "");

function TenderForm({ row }: { row: Row }) {
  const { associations } = useTenderCellContext();
  const preparedBy = (row.assignedTo ?? "")
    .split(",")
    .map((id) => associations.find((a) => a.id === Number(id))?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-3">
        <Fact label="Tender / NIT No" value={row.referenceNo ?? ""} />
        <Fact label="Tender type" value={row.type} />
        <Fact label="Prepared by" value={preparedBy} />
        <Fact label="Last date of submission" value={date(row.deadline)} />
        <Fact label="Published" value={date(row.publishedDate)} />
        <Fact label="Assigned" value={date(row.assignedDate)} />
      </dl>
      {row.tenderBrief && <p className="text-ink-2">{row.tenderBrief}</p>}

      {FIELD_SECTIONS.map(({ title, fields }) => (
        <Section key={title} title={title}>
          {fields
            // The docket number is edited in the table: changing it regroups the rows.
            .filter((f) => f.id !== "docketNo")
            .map((field) => (
              <Labelled key={field.id} label={field.label} wide={field.kind === "textarea"}>
                <FieldEditor field={field} row={row} form />
              </Labelled>
            ))}
          {title === "General" && (
            <>
              <Labelled label="Price">
                <PriceCell row={row} />
              </Labelled>
              <Labelled label="Website">
                <WebsiteCell row={row} />
              </Labelled>
              <Labelled label="Office and consignees" wide>
                <OfficeCell row={row} />
              </Labelled>
            </>
          )}
        </Section>
      ))}

      <Section title="Proposed ERP items">
        <div className="col-span-2">
          <ErpItemsCell row={row} />
        </div>
      </Section>
    </div>
  );
}

/** Mounted only while the sheet is open, so closed cells do not watch the store. */
function SheetBody({ docket }: { docket: string }) {
  const rows = useAppSelector((s) => s.tenderPage.byScope.home.rows).filter(
    (r) => docketKey(r) === docket,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const row = rows.find((r) => r.id === selected) ?? rows[0];

  if (!row) {
    return <p className="text-ink-2">This docket is no longer in pre participation.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-sunken px-3 py-2">
        <div className="font-medium">{row.organization || "No organisation"}</div>
        <div className="mt-0.5 text-ink-2">
          {rows.length} {rows.length === 1 ? "tender" : "tenders"} in this docket
        </div>
      </div>
      {rows.length > 1 && (
        <Choice
          label="Tender"
          options={rows.map((r, i) => ({
            value: r.id,
            label: r.referenceNo || `Tender ${i + 1}`,
          }))}
          value={row.id}
          onChange={(id) => id && setSelected(id)}
        />
      )}
      {/* Keyed so a field's draft never carries over to another tender. */}
      <TenderForm key={row.id} row={row} />
    </div>
  );
}

/** Docket number with the button that opens every field of the docket's tenders. */
export function DocketCell({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const docketNo = (row.docketNo ?? "").trim();
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <FieldEditor field={FIELDS.docketNo} row={row} />
      <Button
        size="sm"
        className="self-start"
        icon={<PanelRight className="size-3.5" />}
        onClick={() => setOpen(true)}
      >
        View
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={docketNo ? `Docket ${docketNo}` : "Tender without a docket"}
        width="46rem"
      >
        <SheetBody docket={docketKey(row)} />
      </Sheet>
    </div>
  );
}
