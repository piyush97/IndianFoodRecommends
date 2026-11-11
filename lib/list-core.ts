/** Server-safe list constants: `eat-list.ts` pulls in a React hook, so server code imports from here. */
export const MAX_LIST = 30;
export const SLUG_RE = /^[a-z0-9-]{1,80}$/;

export function listParam(slugs: string[]): string {
  return slugs.join(",");
}

/** `/list?p=a,b`. Slugs are `[a-z0-9-]` and the comma is legal in a query, so nothing is escaped. */
export function listPath(slugs: string[]): string {
  return `/list?p=${listParam(slugs.filter((s) => SLUG_RE.test(s)))}`;
}
