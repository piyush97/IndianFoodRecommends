// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "./ShareButton";

const props = {
  url: "https://example.com/delhi/place/x",
  title: "Chache Di Hatti",
  text: "Picked by 2 food vloggers",
  slug: "x",
};
const press = () => fireEvent.click(screen.getByRole("button", { name: /Share/ }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.assign(navigator, { share: undefined });
});

describe("ShareButton", () => {
  it("opens the native share sheet when the browser has one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    render(<ShareButton {...props} />);
    press();
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({ url: props.url, title: props.title, text: props.text }),
    );
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("copies the link and says so when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ShareButton {...props} />);
    press();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Link copied"));
    expect(writeText).toHaveBeenCalledWith(props.url);
  });

  it("stays quiet when the user closes the share sheet", async () => {
    const writeText = vi.fn();
    Object.assign(navigator, {
      clipboard: { writeText },
      share: vi.fn().mockRejectedValue(new DOMException("closed", "AbortError")),
    });
    render(<ShareButton {...props} />);
    press();
    await new Promise((r) => setTimeout(r, 20));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("reports a failed copy instead of failing silently", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<ShareButton {...props} />);
    press();
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Could not copy/));
  });
});
