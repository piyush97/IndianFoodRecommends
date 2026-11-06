/** Case-insensitive whole-address match; an empty allowlist admits nobody. */
export function isAdminEmail(email: string | null | undefined, allowlist: string): boolean {
  if (!email) return false;
  const wanted = email.trim().toLowerCase();
  if (!wanted) return false;
  return allowlist
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted);
}
