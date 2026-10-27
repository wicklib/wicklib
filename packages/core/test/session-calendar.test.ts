import { describe, expect, it } from "vitest";

import { SessionCalendar } from "../src/scale/session-calendar";
import type { TradingCalendar } from "../src/types";

const newYork: TradingCalendar = {
  timezone: "America/New_York",
  sessions: [1, 2, 3, 4, 5].map((day) => ({
    openDay: day,
    openTime: "09:30",
    closeDay: day,
    closeTime: "16:00",
  })),
  holidays: ["2025-12-25"],
};

describe("SessionCalendar", () => {
  it("resolves regular-hours opens across both DST transitions", () => {
    const calendar = new SessionCalendar(newYork);

    expect(calendar.sessionAt(Date.UTC(2025, 0, 6, 14, 30))?.start).toBe(
      Date.UTC(2025, 0, 6, 14, 30),
    );
    expect(calendar.sessionAt(Date.UTC(2025, 2, 10, 13, 30))?.start).toBe(
      Date.UTC(2025, 2, 10, 13, 30),
    );
    expect(calendar.sessionAt(Date.UTC(2025, 10, 3, 14, 30))?.start).toBe(
      Date.UTC(2025, 10, 3, 14, 30),
    );
  });

  it("uses the session timezone for open and close boundaries", () => {
    const calendar = new SessionCalendar(newYork);
    const summer = calendar.sessionAt(Date.UTC(2025, 6, 7, 15, 0));

    expect(summer?.start).toBe(Date.UTC(2025, 6, 7, 13, 30));
    expect(summer?.end).toBe(Date.UTC(2025, 6, 7, 20, 0));
    expect(calendar.isOpen(Date.UTC(2025, 6, 7, 20, 0))).toBe(false);
  });

  it("honors weekends and holidays", () => {
    const calendar = new SessionCalendar(newYork);

    expect(calendar.isOpen(Date.UTC(2025, 0, 4, 15, 0))).toBe(false);
    expect(calendar.isOpen(Date.UTC(2025, 11, 25, 15, 0))).toBe(false);
  });

  it("supports overnight sessions", () => {
    const calendar = new SessionCalendar({
      timezone: "America/New_York",
      sessions: [{ openDay: 1, openTime: "22:00", closeDay: 2, closeTime: "02:00" }],
    });

    expect(calendar.isOpen(Date.UTC(2025, 0, 7, 4, 0))).toBe(true);
    expect(calendar.isOpen(Date.UTC(2025, 0, 7, 8, 0))).toBe(false);
  });

  it("returns the session intervals overlapping a range", () => {
    const calendar = new SessionCalendar(newYork);
    const sessions = calendar.sessionsBetween(
      Date.UTC(2025, 2, 10, 0, 0),
      Date.UTC(2025, 2, 11, 0, 0),
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.start).toBe(Date.UTC(2025, 2, 10, 13, 30));
    expect(sessions[0]?.end).toBe(Date.UTC(2025, 2, 10, 20, 0));
  });
});
