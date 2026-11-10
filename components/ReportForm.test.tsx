// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportForm } from "./ReportForm";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

const checked = () => (screen.getByRole("radio", { checked: true }) as HTMLInputElement).value;

describe("ReportForm", () => {
  it("wraps the form in #report and defaults to closed", () => {
    const { container } = render(<ReportForm placeId={1} placeName="Chache Di Hatti" />);
    expect(container.querySelector("#report")).not.toBeNull();
    expect(checked()).toBe("closed");
  });

  it("honours initialKind", () => {
    render(<ReportForm placeId={1} placeName="Chache Di Hatti" initialKind="wrong-info" />);
    expect(checked()).toBe("wrong-info");
  });

  it("the Closed or moved? link opens the form, preselects closed and focuses it", () => {
    const { container } = render(
      <>
        <a href="#report">Closed or moved?</a>
        <ReportForm placeId={1} placeName="Chache Di Hatti" initialKind="other" />
      </>,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(checked()).toBe("other");
    fireEvent.click(screen.getByRole("link", { name: "Closed or moved?" }));
    expect(details.open).toBe(true);
    expect(checked()).toBe("closed");
    expect(document.activeElement).toBe(screen.getByRole("radio", { checked: true }));
  });

  it("does the same when the page loads on #report", () => {
    window.location.hash = "#report";
    const { container } = render(
      <ReportForm placeId={1} placeName="Chache Di Hatti" initialKind="moved" />,
    );
    expect((container.querySelector("details") as HTMLDetailsElement).open).toBe(true);
    expect(checked()).toBe("closed");
  });

  it("hashchange to #report preselects closed", () => {
    render(<ReportForm placeId={1} placeName="Chache Di Hatti" initialKind="moved" />);
    expect(checked()).toBe("moved");
    act(() => {
      window.location.hash = "#report";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(checked()).toBe("closed");
  });
});
