// `redirect` comes from the URL, so it's attacker-controllable: only an
// in-app absolute path is accepted. "//host" and "/\host" are rejected too —
// browsers read both as protocol-relative, i.e. another site.
export function safeRedirect(value: string | null, fallback = "/discover"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
