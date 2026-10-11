import { getSession } from "next-auth/react";
import { toast } from "sonner";

const SIGNED_OUT = "You are signed out. Sign in and try again.";
const STALE_PAGE = "This page is out of date. Refresh the browser and try again.";
const OFFLINE = "Could not reach the server. Check your connection and try again.";
const UNKNOWN = "Something went wrong on the server. Try again.";

/** A rejected thunk gives a string or a plain object, a server action an Error. */
function rawMessage(err: unknown): string {
  if (typeof err === "string") return err;
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "";
}

/**
 * The message a person should read for a failed save or load. Framework and
 * transport errors are replaced with what to do next; a message the server
 * wrote for the user passes through.
 */
export async function describeError(err: unknown): Promise<string> {
  const message = rawMessage(err);
  // A deploy replaced the server actions this tab was built against.
  if (/server action.*(was not found|not found on the server)|failed to find server action/i.test(message)) {
    return STALE_PAGE;
  }
  if (/unauthori[sz]ed|\b401\b/i.test(message)) return SIGNED_OUT;
  if (/failed to fetch|networkerror|load failed/i.test(message)) return OFFLINE;
  // Production builds strip a server action's message, so "signed out" arrives
  // as this generic text. Ask the session which it was.
  if (!message || /omitted in production builds|server components render/i.test(message)) {
    const session = await getSession().catch(() => null);
    return session?.user ? UNKNOWN : SIGNED_OUT;
  }
  return message;
}

/** Error toast for a failed action: "`what`: reason", or the reason alone. */
export function toastError(what: string | null, err: unknown) {
  describeError(err).then((reason) => toast.error(what ? `${what}: ${reason}` : reason));
}
