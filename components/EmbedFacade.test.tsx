// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmbedFacade } from "./EmbedFacade";

afterEach(cleanup);

describe("EmbedFacade", () => {
  it("loads no third-party frame until clicked, then plays at the timestamp", () => {
    const { container } = render(
      <EmbedFacade
        platform="youtube"
        externalId="dQw4w9WgXcQ"
        tsSeconds={252}
        creator="Bhooka Saand"
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play Bhooka Saand's video at 4:12" }));
    const frames = container.querySelectorAll("iframe");
    expect(frames).toHaveLength(1);
    expect(frames[0].getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=252&autoplay=1",
    );
  });

  it("embeds an Instagram reel after click", () => {
    const { container } = render(
      <EmbedFacade platform="instagram" externalId="C9xYz123AbC" tsSeconds={null} creator="A" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open A's reel" }));
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://www.instagram.com/reel/C9xYz123AbC/embed",
    );
  });
});
