"use client";

import { createContext, use, useEffect, useState } from "react";
import { Download, Eye, FileText, FolderOpen, Mail, RefreshCw, Send } from "lucide-react";
import type { SupplyHistoryRecord } from "@/types/supplyHistory";
import { numberRangeFilter } from "@/components/v2/data-table/cells";
import { TextEditCell } from "@/components/v2/data-table/edit-cells";
import { selectFilter, type DataTableColumn } from "@/components/v2/data-table/types";
import { Button } from "@/components/v2/ui/button";
import { describeError } from "@/components/v2/ui/errors";
import { Badge, Dash } from "@/components/v2/ui/field";
import { Dialog } from "@/components/v2/ui/overlay";
import { Skeleton } from "@/components/v2/ui/page";

/** A supply record plus a key that stays the same from one fetch to the next. */
export type Row = SupplyHistoryRecord & { key: string };
type Column = DataTableColumn<Row>;

export type EditableField = "itemSchedule" | "email" | "contactNo";

export type CertState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "ready" }
  | { status: "emailSending" }
  | { status: "emailSent" }
  | { status: "error"; error: string };

/** What the cells need from the page: its saves and the certificate flow. */
export const SupplyContext = createContext<{
  saveField: (row: Row, field: EditableField, value: string) => Promise<void>;
  certStates: Record<string, CertState>;
  /** Recipient emails per party ref no, across all rows that share it. */
  emailsByRef: Map<string, string[]>;
  generateCertificate: (partyRefNo: string) => void;
  sendCertificate: (partyRefNo: string) => void;
}>({
  saveField: async () => {},
  certStates: {},
  emailsByRef: new Map(),
  generateCertificate: () => {},
  sendCertificate: () => {},
});

/* --------------------------------- Formats --------------------------------- */

export function formatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

const formatNumber = (value: number | null) =>
  value == null
    ? ""
    : value.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/* -------------------------------- Validation ------------------------------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailProblem(value: string): string | null {
  if (!value) return null;
  const seen = new Set<string>();
  for (const part of value.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!EMAIL.test(part)) return `Invalid email: ${part}`;
    if (seen.has(part.toLowerCase())) return `Duplicate email: ${part}`;
    seen.add(part.toLowerCase());
  }
  return value.length > 1000 ? "Too many emails (max 1000 chars)" : null;
}

function contactProblem(value: string): string | null {
  if (!value) return null;
  if (!/^[0-9+\-()\s]+$/.test(value)) {
    return "Contact number may only contain digits, +, -, (), spaces";
  }
  const digits = value.replace(/\D/g, "").length;
  return digits < 7 || digits > 15 ? "Contact number must be 7-15 digits" : null;
}

/* ---------------------------------- Cells ---------------------------------- */

function EditCell({
  row,
  field,
  label,
  validate,
}: {
  row: Row;
  field: EditableField;
  label: string;
  validate?: (next: string) => string | null;
}) {
  const { saveField } = use(SupplyContext);
  return (
    <TextEditCell
      multiline={field === "email"}
      label={label}
      value={row[field] ?? ""}
      validate={validate}
      onSave={(next) => saveField(row, field, next)}
    />
  );
}

// Same token v1 sends; the file routes only check its shape.
export const FILE_AUTH = "Bearer MOCK_TOKEN_LASERPOWER_SECURE_AUTH_SCOPE";

interface FileRecord {
  fileId: string;
  filename: string;
  extension: string;
  size: number;
  lastModified: number;
  url?: string;
}

const driveId = (url: string) =>
  (url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/))?.[1];

function nameFromUrl(url: string): string {
  const id = driveId(url);
  if (id) return `drive_document_${id.slice(0, 8)}`;
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).at(-1);
    if (last) return decodeURIComponent(last);
  } catch {
    // Not a URL: fall through.
  }
  return "online_document";
}

function extensionFromUrl(url: string): string {
  const name = nameFromUrl(url);
  const dot = name.lastIndexOf(".");
  if (dot !== -1) return name.slice(dot);
  return driveId(url) ? ".pdf" : "";
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${["Bytes", "KB", "MB", "GB"][i]}`;
}

/** Mounted while the dialog is open: files in the bill's folder, then its online links. */
function DocumentList({ row }: { row: Row }) {
  const [local, setLocal] = useState<FileRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driveNames, setDriveNames] = useState<Record<string, string | null>>({});
  const bill = row.saleBillNumber;
  const attachmentUrl = row.attachmentUrl;

  useEffect(() => {
    if (!bill) return setLocal([]);
    let stale = false;
    fetch(`/api/supply-history/${encodeURIComponent(bill)}/files`, {
      headers: { Authorization: FILE_AUTH },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.text()) || "Failed to load supply bill files.");
        const data = await res.json();
        if (!stale) setLocal(data.files || []);
      })
      .catch(async (err) => {
        const reason = await describeError(err);
        if (!stale) setError(reason);
      });
    return () => {
      stale = true;
    };
  }, [bill]);

  const urls = (attachmentUrl ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  useEffect(() => {
    const list = (attachmentUrl ?? "")
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    fetch("/api/resolve-drive-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: list }),
    })
      .then((r) => r.json())
      .then(({ names }) => setDriveNames(names || {}))
      .catch(() => {});
  }, [attachmentUrl]);

  if (error) return <p className="text-bad">{error}</p>;
  if (!local) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }

  const files: FileRecord[] = [
    ...local,
    ...urls.map((url) => ({
      fileId: "",
      filename: driveNames[url] || nameFromUrl(url),
      extension: extensionFromUrl(url),
      size: 0,
      lastModified: 0,
      url,
    })),
  ];
  if (files.length === 0) return <p className="text-ink-2">No documents found for this sale bill folder.</p>;

  const open = (file: FileRecord, kind: "view" | "download") => {
    const target = file.url
      ? kind === "view" || !driveId(file.url)
        ? file.url
        : `https://docs.google.com/uc?export=download&id=${driveId(file.url)}`
      : `/api/executive-files/${kind}/${file.fileId}?auth=${encodeURIComponent(FILE_AUTH)}`;
    window.open(target, "_blank");
  };

  return (
    <ul>
      {files.map((file, i) => (
        <li key={file.url ? `url-${i}` : file.fileId} className="flex items-center gap-2 border-b py-1.5 last:border-b-0">
          <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate" title={file.filename}>
                {file.filename}
              </span>
              {file.url && <Badge>Online</Badge>}
            </div>
            <div className="text-xs text-ink-3">
              {file.url
                ? "Online document"
                : `${formatSize(file.size)} · ${new Date(file.lastModified).toLocaleDateString()}`}
            </div>
          </div>
          {file.extension.toLowerCase() === ".pdf" && (
            <Button size="sm" icon={<Eye className="size-3.5" />} onClick={() => open(file, "view")}>
              Preview
            </Button>
          )}
          <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => open(file, "download")}>
            Download
          </Button>
        </li>
      ))}
    </ul>
  );
}

function DocumentsCell({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  if (!row.hasDocuments && !row.attachmentUrl) return <Dash />;
  return (
    <>
      <Button size="sm" icon={<FolderOpen className="size-3.5" />} onClick={() => setOpen(true)}>
        View files
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Documents for sale bill ${row.saleBillNumber ?? ""}`}
        width="40rem"
        footer={<Button onClick={() => setOpen(false)}>Close</Button>}
      >
        <DocumentList row={row} />
      </Dialog>
    </>
  );
}

function CertificateCell({ row }: { row: Row }) {
  const { certStates, emailsByRef, generateCertificate, sendCertificate } = use(SupplyContext);
  const ref = row.partyRefNo;
  if (!ref) return <Dash />;

  const state = certStates[ref] ?? { status: "idle" };
  const emails = emailsByRef.get(ref) ?? [];

  switch (state.status) {
    case "generating":
      return <Button size="sm" loading disabled>Generating</Button>;
    case "emailSending":
      return <Button size="sm" loading disabled>Sending</Button>;
    case "emailSent":
      return (
        <span className="inline-flex items-center gap-1 font-medium text-good">
          <Send className="size-3.5" aria-hidden /> Sent
        </span>
      );
    case "error":
      return (
        <Button
          size="sm"
          icon={<RefreshCw className="size-3.5" />}
          title={state.error}
          onClick={() => generateCertificate(ref)}
        >
          Retry
        </Button>
      );
  }

  if (!row.certificateUrl && state.status !== "ready") {
    return (
      <Button size="sm" icon={<FileText className="size-3.5" />} onClick={() => generateCertificate(ref)}>
        Generate PDF
      </Button>
    );
  }
  return (
    <div className="flex gap-1.5">
      <Button
        size="sm"
        icon={<FileText className="size-3.5" />}
        title="Re-generate certificate"
        onClick={() => generateCertificate(ref)}
      >
        PDF
      </Button>
      <Button
        size="sm"
        variant="primary"
        icon={<Mail className="size-3.5" />}
        disabled={emails.length === 0}
        title={
          emails.length === 0
            ? "No recipient email. Add Email first"
            : `Send to ${emails[0]}${emails.length > 1 ? ` + ${emails.length - 1} cc` : ""}`
        }
        onClick={() => sendCertificate(ref)}
      >
        Send email
      </Button>
    </div>
  );
}

/* --------------------------------- Columns --------------------------------- */

type TextKey = "fy" | "saleBillNumber" | "partyName" | "itemCode" | "itemName" | "lrNo" | "partyRefNo" | "contractVrNo" | "quotationNo" | "docketNo" | "utility";

const text = (id: TextKey | EditableField, header: string, width: number): Column => ({
  id,
  header,
  width,
  filter: selectFilter(),
  text: (row) => row[id] ?? "",
});

const date = (id: "saleBillDate" | "partyRefDate", header: string): Column => ({
  id,
  header,
  width: 160,
  filter: { type: "dateRange" },
  text: (row) => formatDate(row[id]),
});

const number = (id: "rate" | "invoiceQty" | "invoiceAmt", header: string): Column => ({
  id,
  header,
  width: 140,
  filter: numberRangeFilter,
  text: (row) => formatNumber(row[id]),
});

const editable = (
  id: EditableField,
  header: string,
  width: number,
  validate?: (next: string) => string | null,
): Column => ({
  ...text(id, header, width),
  cell: (row) => <EditCell row={row} field={id} label={header} validate={validate} />,
});

/** The sheet columns, in the order the Excel export writes them. */
export const dataColumns: Column[] = [
  text("fy", "FY", 100),
  text("saleBillNumber", "Sale Bill No", 150),
  date("saleBillDate", "Sale Bill Date"),
  text("partyName", "Party Name", 220),
  text("itemCode", "Item Code", 130),
  editable("itemSchedule", "Item Schedule", 200),
  text("itemName", "Item Name", 240),
  text("lrNo", "LR No", 150),
  text("partyRefNo", "Party Ref No", 160),
  date("partyRefDate", "Party Ref Date"),
  text("contractVrNo", "Contract VR No", 160),
  text("quotationNo", "Quotation No", 140),
  text("docketNo", "Docket No", 150),
  text("utility", "Utility", 240),
  number("rate", "Rate"),
  number("invoiceQty", "Invoice Qty"),
  number("invoiceAmt", "Invoice Amt"),
  editable("email", "Email", 240, emailProblem),
  editable("contactNo", "Contact No", 180, contactProblem),
  {
    id: "hasDocuments",
    header: "Documents",
    width: 150,
    filter: { type: "boolean" },
    text: (row) => (row.hasDocuments ? "Yes" : "No"),
    cell: (row) => <DocumentsCell row={row} />,
  },
  {
    id: "certificateSentDate",
    header: "Certificate Sent Date",
    width: 190,
    filter: { type: "dateRange" },
    text: (row) => (row.certificateSentDate ? formatDate(row.certificateSentDate) : "Not Sent"),
  },
];

export const columns: Column[] = [
  ...dataColumns,
  {
    id: "certificate",
    header: "Certificate",
    width: 210,
    search: false,
    sortable: false,
    cell: (row) => <CertificateCell row={row} />,
  },
];
