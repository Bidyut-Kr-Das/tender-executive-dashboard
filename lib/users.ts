import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/** The password a new or reset account signs in with until the user changes it. */
const DEFAULT_PASSWORD = "Laser@1234";

export const hashDefaultPassword = () => bcrypt.hash(DEFAULT_PASSWORD, 10);

/** Sets the account's password back to the default. Throws "User not found". */
export async function resetPasswordToDefault(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user) throw new Error("User not found");
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashDefaultPassword() },
  });
  return { email: user.email, userId: user.id };
}
