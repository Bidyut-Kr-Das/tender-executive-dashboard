"use server";

import { prisma } from "@/lib/prisma";

export async function getRailways() {
  return prisma.railways.findMany({ orderBy: { dueDate: "desc" } });
}