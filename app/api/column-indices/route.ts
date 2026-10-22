import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // The admin page also lists deleted entries, so they can be restored.
    const withDeleted = request.nextUrl.searchParams.get("include") === "deleted";
    const indices = await prisma.columnIndex.findMany({
      where: withDeleted ? undefined : { status: "active" },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ indices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { columnName, displayOrder, visible, width, frozen, displayName } = body;

    if (!columnName || displayOrder === undefined) {
      return NextResponse.json(
        { error: "columnName and displayOrder are required" },
        { status: 400 },
      );
    }

    const index = await prisma.columnIndex.create({
      data: {
        columnName,
        displayOrder,
        displayName: displayName || null,
        visible: visible ?? true,
        width: width ?? null,
        frozen: frozen ?? false,
      },
    });

    return NextResponse.json({ index }, { status: 201 });
  } catch (error) {
    if ((error as any)?.code === "P2002") {
      return NextResponse.json(
        { error: "A column index for this columnName already exists. If it is deleted, restore it." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
