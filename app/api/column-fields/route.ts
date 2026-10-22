import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TENDER_COLUMNS } from "@/lib/tender-query";

const SKIP_COLS = new Set(["id", "fileId", "createdAt", "updatedAt", "tenderStatusId", "utilityMappingId"]);

export async function GET() {
  try {
    const allFields = new Set([...TENDER_COLUMNS].filter((c) => !SKIP_COLS.has(c)));

    const groupRows = await prisma.columnGroup.findMany({
      select: { label: true },
      where: { status: "active" },
    });
    for (const row of groupRows) {
      allFields.add(row.label);
    }

    const columnIndices = await prisma.columnIndex.findMany({
      where: { status: "active" },
      orderBy: { displayOrder: "asc" },
      select: { columnName: true, displayName: true, displayOrder: true, visible: true, width: true, frozen: true },
    });

    return NextResponse.json({
      fields: Array.from(allFields).sort((a, b) => a.localeCompare(b)),
      columnIndices,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
