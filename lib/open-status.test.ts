import { describe, expect, it } from "vitest";
import { weekSchedule } from "./opening-hours";
import { openStatus, type Week } from "./open-status";

const at = (local: string) => new Date(`${local}+05:30`);
const monday = at("2026-11-16T12:00:00");

function weekOf(tag: string): Week {
  const week = weekSchedule(tag, monday);
  if (!week) throw new Error(`Could not parse ${tag}`);
  return week;
}

describe("openStatus", () => {
  it("is open during the day and says when it closes", () => {
    expect(openStatus(weekOf("Mo-Su 08:00-23:00"), at("2026-11-19T12:00:00"))).toEqual({
      open: true,
      until: "11 PM",
    });
  });

  it("is closed after hours and says when it opens", () => {
    expect(openStatus(weekOf("Mo-Su 08:00-23:00"), at("2026-11-19T23:30:00"))).toEqual({
      open: false,
      opensAt: "8 AM",
    });
  });

  it("stays open after midnight for the previous day's interval", () => {
    expect(openStatus(weekOf("Mo-Su 18:00-02:00"), at("2026-11-17T01:00:00"))).toEqual({
      open: true,
      until: "2 AM",
    });
  });

  it("is open around the clock for 24/7, with no closing time", () => {
    expect(openStatus(weekOf("24/7"), at("2026-11-19T03:00:00"))).toEqual({ open: true });
  });

  it("joins intervals that touch at midnight", () => {
    const week = weekOf("Mo-Su 00:00-02:00,18:00-24:00");
    expect(openStatus(week, at("2026-11-19T23:00:00"))).toEqual({ open: true, until: "2 AM" });
  });

  it("returns null when there is nothing to show", () => {
    const empty: Week = [[], [], [], [], [], [], []];
    expect(openStatus(empty, at("2026-11-19T12:00:00"))).toBeNull();
  });
});
