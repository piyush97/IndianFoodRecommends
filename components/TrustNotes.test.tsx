import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrustNotes, trustNotes } from "./TrustNotes";

const open = {
  pickedOn: "2026-03-14",
  status: "open" as const,
  statusChangedAt: null,
  flagged: false,
};

describe("trustNotes", () => {
  it("always says when the place was last in a video", () => {
    expect(trustNotes(open)).toEqual(["Last in a video: Mar 2026"]);
  });

  it("says visitors reported it closed, or moved when every report says moved", () => {
    expect(trustNotes({ ...open, flagged: true, flagKind: "closed" })).toEqual([
      "Visitors reported this closed. We are checking.",
      "Last in a video: Mar 2026",
    ]);
    expect(trustNotes({ ...open, flagged: true, flagKind: "moved" })[0]).toBe(
      "Visitors reported this moved. We are checking.",
    );
  });

  it("warns on a moved place", () => {
    expect(trustNotes({ ...open, status: "moved" })).toEqual([
      "Reported moved: check the location before you go.",
      "Last in a video: Mar 2026",
    ]);
  });

  it("confirms a closed place with the month the site confirmed it", () => {
    expect(
      trustNotes({ ...open, status: "closed", statusChangedAt: "2026-10-15T00:00:00.000Z" }),
    ).toEqual(["Closed (confirmed Oct 2026)", "Last in a video: Mar 2026"]);
  });

  it("renders the status as text", () => {
    const html = renderToStaticMarkup(
      <TrustNotes
        trust={{ ...open, status: "closed", statusChangedAt: "2026-10-15T00:00:00.000Z" }}
      />,
    );
    expect(html).toContain("Closed (confirmed Oct 2026)");
    expect(html).toContain("Last in a video: Mar 2026");
  });
});
