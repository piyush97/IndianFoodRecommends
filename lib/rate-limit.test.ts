import { describe, expect, it } from "vitest";
import { clientIp } from "./rate-limit";

function req(headers: Record<string, string>) {
  return new Request("http://x/", { headers });
}

describe("clientIp", () => {
  it("uses the first x-forwarded-for address", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9, 198.51.100.1" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.10" }))).toBe("203.0.113.10");
  });

  it("shares one bucket when no address is present", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });

  it("groups addresses in the same IPv6 /64 together", () => {
    expect(clientIp(req({ "x-forwarded-for": "2001:db8:85a3:8d3:1::1" }))).toBe(
      "2001:db8:85a3:8d3::/64",
    );
    expect(clientIp(req({ "x-forwarded-for": "2001:0DB8:85a3:08d3:ffff::2" }))).toBe(
      "2001:db8:85a3:8d3::/64",
    );
  });

  it("keeps different IPv6 /64 blocks apart", () => {
    expect(clientIp(req({ "x-forwarded-for": "2001:db8:85a3:8d3::1" }))).not.toBe(
      clientIp(req({ "x-forwarded-for": "2001:db8:85a3:8d4::1" })),
    );
  });

  it("treats IPv4-mapped IPv6 as the IPv4 address", () => {
    expect(clientIp(req({ "x-forwarded-for": "::ffff:203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("does not group loopback", () => {
    expect(clientIp(req({ "x-forwarded-for": "::1" }))).toBe("::1");
  });
});
