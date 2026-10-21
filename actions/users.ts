"use server";

import { withLog } from "@/lib/activity-logger";
import { requireDeveloperAction } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { isUserRole } from "@/lib/user-roles";
import { hashDefaultPassword, resetPasswordToDefault } from "@/lib/users";

// Never the password hash.
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

function assertRole(role: string) {
  if (!isUserRole(role)) throw new Error(`Unknown role "${role}"`);
}

export const listUsers = withLog(
  async () => {
    await requireDeveloperAction();
    return prisma.user.findMany({ select: USER_SELECT, orderBy: { createdAt: "asc" } });
  },
  () => null,
);

export const createUser = withLog(
  async (params: { name: string; email: string; role: string }) => {
    await requireDeveloperAction();
    const email = params.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email");
    assertRole(params.role);
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new Error("A user with this email already exists");
    }
    return prisma.user.create({
      data: {
        name: params.name.trim() || null,
        email,
        role: params.role,
        passwordHash: await hashDefaultPassword(),
      },
      select: USER_SELECT,
    });
  },
  (user) => ({
    action: "CREATE" as const,
    tableName: "User",
    recordId: user.id,
    details: `Created user ${user.email} with role ${user.role}`,
  }),
);

export const updateUserRole = withLog(
  async (params: { id: string; role: string }) => {
    const me = await requireDeveloperAction();
    assertRole(params.role);
    // A developer demoting themselves would lose this page mid-edit.
    if (params.id === me.id) throw new Error("You cannot change your own role");
    return prisma.user.update({
      where: { id: params.id },
      data: { role: params.role },
      select: USER_SELECT,
    });
  },
  (user) => ({
    action: "UPDATE" as const,
    tableName: "User",
    recordId: user.id,
    details: `Changed role of ${user.email} to ${user.role}`,
  }),
);

export const setUserActive = withLog(
  async (params: { id: string; active: boolean }) => {
    const me = await requireDeveloperAction();
    if (params.id === me.id) throw new Error("You cannot deactivate yourself");
    return prisma.user.update({
      where: { id: params.id },
      data: { active: params.active },
      select: USER_SELECT,
    });
  },
  (user) => ({
    action: "UPDATE" as const,
    tableName: "User",
    recordId: user.id,
    details: `${user.active ? "Activated" : "Deactivated"} user ${user.email}`,
  }),
);

export const resetUserPassword = withLog(
  async (email: string) => {
    await requireDeveloperAction();
    return resetPasswordToDefault(email);
  },
  (result) => ({
    action: "UPDATE" as const,
    tableName: "User",
    recordId: result.userId,
    details: `Reset password of ${result.email} to the default`,
  }),
);
