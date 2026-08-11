/**
 * Next implements redirect() by THROWING a special error and letting the
 * framework catch it. Any `try { await serverAction() } catch` around a
 * server action that redirects will therefore catch its own success and
 * show the user "NEXT_REDIRECT" as if something broke.
 *
 * Wrap every catch that surrounds a redirecting action with this.
 */
export function isRedirectError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/** The message to show a user, or null when the "error" was a redirect. */
export function errorMessage(err: unknown, fallback = "Failed to save"): string | null {
  if (isRedirectError(err)) return null;
  return err instanceof Error ? err.message : fallback;
}
