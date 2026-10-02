import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withLog } from "@/lib/activity-logger";

export const runtime = "nodejs";

const ALLOWED_FIELDS = new Set(["email", "contactNo", "itemSchedule"]);

function validateField(field: string, value: string | null): string | null {
  const v = value == null ? "" : String(value).trim();
  if (field === "email") {
    if (v === "") return null;
    if (v.length > 1000) return "Too many emails (max 1000 chars)";
    const parts = v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return null;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seen = new Set<string>();
    for (const p of parts) {
      if (p.length > 254) return `Email too long: ${p.slice(0, 30)}`;
      if (!re.test(p)) return `Invalid email: ${p}`;
      const lower = p.toLowerCase();
      if (seen.has(lower)) return `Duplicate email: ${p}`;
      seen.add(lower);
    }
    return null;
  }
  if (field === "contactNo") {
    if (v === "") return null;
    if (v.length > 30) return "Contact number too long (max 30)";
    const re = /^[0-9+\-()\s]+$/;
    if (!re.test(v)) return "Contact number may only contain digits, +, -, (), spaces";
    const digits = v.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return "Contact number must be 7-15 digits";
    return null;
  }
  if (field === "itemSchedule") {
    if (v.length > 500) return "Item Schedule too long (max 500)";
    return null;
  }
  return "Unknown field";
}

async function runUpdateSupplyHistory(params: { saleBillNumber: string; itemCode: string; field: string; value: string | null; id?: string }) {
  const { saleBillNumber, itemCode, field, value, id } = params;
  if (!ALLOWED_FIELDS.has(field)) throw Object.assign(new Error(`Field ${field} not allowed`), { status: 400 });

  const validationError = validateField(field, value);
  if (validationError) throw Object.assign(new Error(validationError), { status: 400 });

  const normalizedValue = value == null || String(value).trim() === "" ? null : String(value).trim();

  let where: any;
  let existing: any = null;
  if (id) {
    where = { id };
    existing = await prisma.supplyHistory.findUnique({ where });
    if (!existing) throw Object.assign(new Error("Record not found"), { status: 404 });
  } else {
    if (!saleBillNumber || !itemCode) throw Object.assign(new Error("saleBillNumber and itemCode required"), { status: 400 });
    where = { saleBillNumber_itemCode: { saleBillNumber, itemCode } };
    existing = await prisma.supplyHistory.findUnique({ where });
    if (!existing) throw Object.assign(new Error("Record not found for given saleBillNumber/itemCode"), { status: 404 });
  }

  // Email: removals apply to the edited source row only. Additions propagate
  // (appended, never removed) to every other row sharing the same partyName.
  if (field === "email") {
    const partyName = existing.partyName;
    if (partyName && String(partyName).trim() !== "") {
      const candidates = normalizedValue
        ? normalizedValue.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const originalLower = (existing.email ?? "").toLowerCase();
      const added = candidates.filter((c) => !originalLower.includes(c.toLowerCase()));

      const partyRows = await prisma.supplyHistory.findMany({ where: { partyName } });
      const updates: { id: string; email: string | null }[] = [];
      // Source row is always replaced with the incoming value (handles removal + clear).
      updates.push({ id: existing.id, email: normalizedValue });
      for (const row of partyRows) {
        if (row.id === existing.id) continue;
        const current = (row.email ?? "").trim();
        const lower = current.toLowerCase();
        const toAdd = added.filter((c) => !lower.includes(c.toLowerCase()));
        if (toAdd.length === 0) continue;
        updates.push({ id: row.id, email: current === "" ? toAdd.join(",") : `${current},${toAdd.join(",")}` });
      }

      await prisma.$transaction(
        updates.map((u) => prisma.supplyHistory.update({ where: { id: u.id }, data: { email: u.email } })),
      );

      const updatedRows = await prisma.supplyHistory.findMany({ where: { partyName } });
      const primary = updatedRows.find((r) => r.id === existing.id) ?? existing;
      return {
        updated: primary,
        field,
        saleBillNumber: primary.saleBillNumber,
        itemCode: primary.itemCode,
        value: primary.email,
        previousValue: existing.email,
        updatedEmails: updatedRows.map((r) => ({
          saleBillNumber: r.saleBillNumber,
          itemCode: r.itemCode,
          email: r.email,
        })),
        affectedCount: updates.length,
      };
    }
  }

  const data: any = { [field]: normalizedValue };
  const updated = await prisma.supplyHistory.update({ where: id ? { id } : where, data });

  return { updated, field, saleBillNumber: updated.saleBillNumber, itemCode: updated.itemCode, value: normalizedValue, previousValue: existing[field] };
}

const updateSupplyHistoryWithLog = withLog(
  runUpdateSupplyHistory,
  (result, params) => ({
    action: "UPDATE" as const,
    tableName: "SupplyHistory",
    recordId: `${result.saleBillNumber}|${result.itemCode}`,
    details: `Updated ${result.field} on SupplyHistory ${result.saleBillNumber}|${result.itemCode}: "${result.previousValue ?? ""}" → "${result.value ?? ""}"`,
  }),
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { saleBillNumber, itemCode, field, value, id } = body ?? {};

    if (!field) {
      return NextResponse.json({ success: false, error: "field required (email|contactNo|itemSchedule)" }, { status: 400 });
    }

    const result = await updateSupplyHistoryWithLog({ saleBillNumber, itemCode, field, value: value ?? null, id });
    return NextResponse.json({
      success: true,
      data: result.updated,
      updatedEmails: (result as any).updatedEmails ?? null,
      affectedCount: (result as any).affectedCount ?? 1,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ success: false, error: err.message || "Failed to update" }, { status });
  }
}

// Also support PATCH
export async function PATCH(req: NextRequest) {
  return POST(req);
}
