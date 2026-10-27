import { describe, expect, it } from "vitest";

import { SessionCalendar } from "../src/scale/session-calendar";
import { TimeScale, type TimeScaleSource } from "../src/scale/time-scale";

const MINUTE = 60_000;
const start = Date.UTC(2025, 2, 10, 13, 0);

const source: TimeScaleSource = {
  count: () => 481,
  timeAt: (index) => (index >= 0 && index <= 480 ? start + index * MINUTE : undefined),
  nearestIndex: (time) => Math.max(0, Math.min(480, Math.round((time - start) / MINUTE))),
};

describe("session-aware time ticks", () => {
  it("skips closed ticks and includes session boundaries", () => {
    const tradingCalendar = {
      timezone: "America/New_York",
      sessions: [
        {
          openDay: 1,
          openTime: "09:30",
          closeDay: 1,
          closeTime: "16:00",
        },
      ],
    };
    const calendar = new SessionCalendar(tradingCalendar);
    const scale = new TimeScale(source, { calendar: tradingCalendar });
    scale.setWidth(800);
    scale.setVisibleRange({
      from: Date.UTC(2025, 2, 10, 13, 0),
      to: Date.UTC(2025, 2, 10, 21, 0),
    });

    const ticks = scale.getTimeTicks(800);
    expect(ticks).toContain(Date.UTC(2025, 2, 10, 13, 30));
    expect(ticks).toContain(Date.UTC(2025, 2, 10, 20, 0));
    expect(
      ticks.filter((time) => !calendar.isOpen(time) && time !== Date.UTC(2025, 2, 10, 20, 0)),
    ).toEqual([]);
    expect(scale.getCalendarTimezone()).toBe("America/New_York");
  });
});
