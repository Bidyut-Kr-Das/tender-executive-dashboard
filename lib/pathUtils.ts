import path from "path";

/**
 * Convert any stored relative path (which may contain Windows backslashes
 * if indexed on Windows) to a portable forward-slash form.
 * Used at write-time to make DB tokens platform-neutral.
 */
export function toPortableRelative(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Resolve a base + relative path where relative may contain
 * Windows backslashes (\\) or mixed separators.
 * Works on both Windows (Z:\...) and Linux (/mnt/...).
 *
 * Normalizes relative to forward slashes before joining, because:
 * - On Linux, path.join treats \ as a literal character (bug)
 * - On Windows, path.join handles both / and \ correctly
 * So normalizing to / is the cross-platform canonical form.
 */
export function resolvePortablePath(base: string, relative: string): string {
  const normalizedRelative = relative.replace(/\\/g, "/");
  return path.resolve(path.join(base, normalizedRelative));
}
