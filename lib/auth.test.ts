import { describe, expect, it } from "vitest";
import { isAdminEmail } from "./admin-email";

describe("isAdminEmail", () => {
  const allow = "editor@example.com, second@example.com";

  it("accepts a listed email regardless of case and spaces", () => {
    expect(isAdminEmail(" Editor@Example.com ", allow)).toBe(true);
  });

  it("rejects an unlisted email", () => {
    expect(isAdminEmail("nobody@example.com", allow)).toBe(false);
  });

  it("rejects a missing email", () => {
    expect(isAdminEmail(null, allow)).toBe(false);
    expect(isAdminEmail(undefined, allow)).toBe(false);
  });

  it("rejects everyone when the allowlist is empty", () => {
    expect(isAdminEmail("editor@example.com", "")).toBe(false);
  });

  it("matches whole addresses only, never prefixes", () => {
    expect(isAdminEmail("editor@example.com.evil.test", allow)).toBe(false);
  });
});
