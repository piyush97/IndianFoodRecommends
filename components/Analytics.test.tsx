// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: (props: Record<string, string>) => <script data-testid="umami" {...props} />,
}));

const { Analytics } = await import("./Analytics");

afterEach(cleanup);

describe("Analytics", () => {
  it("renders nothing without a website id", () => {
    const { container } = render(<Analytics websiteId="" />);
    expect(container.innerHTML).toBe("");
  });

  it("loads the Umami script with do-not-track honoured", () => {
    const { getByTestId } = render(<Analytics websiteId="abc-123" />);
    const script = getByTestId("umami");
    expect(script.getAttribute("src")).toBe("https://cloud.umami.is/script.js");
    expect(script.getAttribute("data-website-id")).toBe("abc-123");
    expect(script.getAttribute("data-do-not-track")).toBe("true");
  });
});
