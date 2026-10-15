import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";
import { parseDate } from "@/lib/parse-date";

const SUCCESS_EVENT = "performance_cert.completed_success";

interface CertDetail {
  certificate_id?: string;
  issuing_date?: string | null;
  signing_date?: string | null;
  party_reference_no?: string | null;
}

interface CertDuplicate {
  certificate_id?: string;
  duplicate_of?: string[];
}

interface CertReport {
  details?: CertDetail[];
  duplicates?: CertDuplicate[];
}

interface CertEvent {
  id: string;
  event: string;
  data: { job_id: string; result: unknown; error: unknown };
}

// certificate_id is the row's display id (PERF-CERT-####); its trailing number is `serial`.
function serialFromCertId(id: string): number | null {
  const match = /(\d+)\s*$/.exec(id);
  return match ? Number(match[1]) : null;
}

function dateOrUndefined(value: string | null | undefined): Date | undefined {
  const parsed = value ? parseDate(value) : null;
  return parsed ?? undefined;
}

async function handleCertEvent(
  evt: CertEvent,
): Promise<{ handled: boolean; updated: number; linked: number; notFound: number[] }> {
  // A failed event carries only data.error; nothing on the certificate to store.
  if (evt.event !== SUCCESS_EVENT || evt.data.error) {
    return { handled: false, updated: 0, linked: 0, notFound: [] };
  }

  const report = (evt.data.result ?? {}) as CertReport;
  const details = Array.isArray(report.details) ? report.details : [];
  const duplicates = Array.isArray(report.duplicates) ? report.duplicates : [];

  const serialOf = (certificateId?: string) =>
    certificateId ? serialFromCertId(certificateId) : null;

  const serials = [
    ...new Set(
      [...details, ...duplicates]
        .map((c) => serialOf(c?.certificate_id))
        .filter((s): s is number => s !== null),
    ),
  ];
  if (serials.length === 0) return { handled: true, updated: 0, linked: 0, notFound: [] };

  const certRows = await prisma.performanceCertificate.findMany({
    where: { serial: { in: serials } },
    select: { id: true, serial: true },
  });
  const idBySerial = new Map(certRows.map((r) => [r.serial, r.id]));

  // SupplyHistory rows grouped by partyRefNo, so each certificate links its matches.
  const refs = [
    ...new Set(
      details
        .map((d) => d?.party_reference_no?.trim())
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const supplyRows = refs.length
    ? await prisma.supplyHistory.findMany({
        where: { partyRefNo: { in: refs } },
        select: { id: true, partyRefNo: true },
      })
    : [];
  const supplyByRef = new Map<string, string[]>();
  for (const row of supplyRows) {
    if (!row.partyRefNo) continue;
    const list = supplyByRef.get(row.partyRefNo) ?? [];
    list.push(row.id);
    supplyByRef.set(row.partyRefNo, list);
  }

  type CertUpdate = {
    issueDate?: Date;
    signingDate?: Date;
    duplicateOfId?: string | null;
    partyReferenceNo?: string;
    supplyHistoryIds?: string[];
  };
  const updates = new Map<string, CertUpdate>();
  const draft = (id: string): CertUpdate => {
    const existing = updates.get(id);
    if (existing) return existing;
    const created: CertUpdate = {};
    updates.set(id, created);
    return created;
  };

  for (const d of details) {
    const id = idBySerial.get(serialOf(d?.certificate_id) ?? -1);
    if (!id) continue;
    const data = draft(id);
    const issueDate = dateOrUndefined(d.issuing_date);
    const signingDate = dateOrUndefined(d.signing_date);
    if (issueDate) data.issueDate = issueDate;
    if (signingDate) data.signingDate = signingDate;
    const ref = d.party_reference_no?.trim();
    if (ref) {
      data.partyReferenceNo = ref;
      const ids = supplyByRef.get(ref);
      if (ids?.length) data.supplyHistoryIds = ids;
    }
  }

  for (const d of duplicates) {
    const id = idBySerial.get(serialOf(d?.certificate_id) ?? -1);
    if (!id) continue;
    const originalId = (d.duplicate_of ?? [])
      .map((ref) => idBySerial.get(serialFromCertId(ref) ?? -1))
      .find((v): v is string => Boolean(v));
    draft(id).duplicateOfId = originalId ?? null;
  }

  let updated = 0;
  let linked = 0;
  for (const [id, data] of updates) {
    const { supplyHistoryIds, ...fields } = data;
    if (Object.keys(fields).length === 0 && !supplyHistoryIds?.length) continue;
    await prisma.performanceCertificate.update({
      where: { id },
      data: {
        ...fields,
        ...(supplyHistoryIds?.length
          ? { supplyHistories: { connect: supplyHistoryIds.map((sid) => ({ id: sid })) } }
          : {}),
      },
    });
    updated++;
    if (supplyHistoryIds?.length) linked += supplyHistoryIds.length;
  }

  const notFound = serials.filter((s) => !idBySerial.has(s));
  return { handled: true, updated, linked, notFound };
}

const receiveEvent = withLog(handleCertEvent, (result, evt) => ({
  action: "UPDATE" as const,
  tableName: "PerformanceCertificate",
  referenceNo: evt.data.job_id || undefined,
  details: `performance-certificate webhook ${evt.event} id=${evt.id} job=${evt.data.job_id || "(none)"}${
    evt.data.error
      ? ` error=${typeof evt.data.error === "string" ? evt.data.error : JSON.stringify(evt.data.error)}`
      : ""
  }${result.handled ? ` updated=${result.updated} linked=${result.linked} notFound=[${result.notFound.join(",")}]` : ""}`,
  // Public webhook — no auth session, so label the actor explicitly.
  userId: null,
  userName: "Performance Certificate Agent",
  userEmail: "ai-agent@laserpower.in",
}));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log(`[PerformanceCertificate] webhook received: ${JSON.stringify(body)}`);
    const data = body?.data;

    if (typeof body?.id !== "string" || !body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (typeof body?.event !== "string" || !body.event) {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "data is required" }, { status: 400 });
    }

    const result = await receiveEvent({
      id: body.id,
      event: body.event,
      data: {
        job_id: typeof data.job_id === "string" ? data.job_id : "",
        result: data.result ?? null,
        error: data.error ?? null,
      },
    });
    return NextResponse.json({ success: true, id: body.id, event: body.event, ...result });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status },
    );
  }
}
