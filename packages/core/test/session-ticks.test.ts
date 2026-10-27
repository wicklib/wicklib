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

function sessionSource(): TimeScaleSource {
  const times: number[] = [];
  for (const day of [7, 8]) {
    for (let index = 0; index < 390; index += 1) {
      times.push(Date.UTC(2025, 6, day, 13, 30) + index * MINUTE);
    }
  }
  return {
    count: () => times.length,
    timeAt: (index) => times[index],
    nearestIndex: (time) => {
      let best = 0;
      let distance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < times.length; index += 1) {
        const candidate = Math.abs(times[index]! - time);
        if (candidate < distance) {
          distance = candidate;
          best = index;
        }
      }
      return best;
    },
  };
}

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

    scale.setOptions({ calendar: null });
    expect(scale.getCalendarTimezone()).toBeNull();
  });

  it("shows fixed-width gaps between sessions", () => {
    const tradingCalendar = {
      timezone: "America/New_York",
      sessions: [1, 2, 3, 4, 5].map((day) => ({
        openDay: day,
        openTime: "09:30",
        closeDay: day,
        closeTime: "16:00",
      })),
    };
    const scale = new TimeScale(sessionSource(), {
      calendar: tradingCalendar,
      gapMode: "show",
      gapWidth: 40,
    });
    scale.setWidth(1136);
    scale.fitContent();

    const first = scale.indexToX(389);
    const second = scale.indexToX(390);
    expect(second - first).toBeGreaterThan(40);
    expect(scale.isGapX((first + second) / 2)).toBe(true);

    const compressed = new TimeScale(sessionSource(), {
      calendar: tradingCalendar,
      gapMode: "compress",
    });
    compressed.setWidth(1136);
    compressed.fitContent();
    expect(compressed.indexToX(390) - compressed.indexToX(389)).toBeLessThan(10);

    const anchorX = scale.indexToX(100);
    const anchorIndex = scale.xToIndex(anchorX);
    scale.zoomAt(anchorX, -120);
    expect(scale.xToIndex(anchorX)).toBeCloseTo(anchorIndex, 1);
  });

  it("prefers an open over a close at a compressed session boundary", () => {
    const tradingCalendar = {
      timezone: "America/New_York",
      sessions: [1, 2, 3, 4, 5].map((day) => ({
        openDay: day,
        openTime: "09:30",
        closeDay: day,
        closeTime: "16:00",
      })),
    };
    const scale = new TimeScale(sessionSource(), {
      calendar: tradingCalendar,
      rightOffset: 30,
    });
    scale.setWidth(1136);
    scale.fitContent();

    const ticks = scale.getTimeTicks(1136);
    expect(ticks).toContain(Date.UTC(2025, 6, 8, 13, 30));
    expect(ticks).not.toContain(Date.UTC(2025, 6, 7, 20, 0));
  });
});
