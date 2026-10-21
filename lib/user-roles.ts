/** Roles a user can hold, least access first. */
export const USER_ROLES = ["user", "admin", "developer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const isUserRole = (value: string): value is UserRole =>
  (USER_ROLES as readonly string[]).includes(value);
