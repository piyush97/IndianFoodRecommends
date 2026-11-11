/** Server-safe list constants: `eat-list.ts` pulls in a React hook, so server code imports from here. */
export const MAX_LIST = 30;
export const SLUG_RE = /^[a-z0-9-]{1,80}$/;

export function listParam(slugs: string[]): string {
  return slugs.join(",");
}
