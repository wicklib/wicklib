import { fail } from "../errors";
import type { SessionWindow, TradingCalendar } from "../types";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

interface NormalizedWindow {
  openDay: number;
  openMinutes: number;
  closeDay: number;
  closeMinutes: number;
}

export interface SessionInterval {
  start: number;
  end: number;
}

/**
 * Resolves a host-supplied weekly trading calendar in UTC.
 *
 * Local session times are interpreted in the calendar's IANA time zone. DST gaps and
 * overlaps are resolved deterministically; no ambient clock is used.
 */
export class SessionCalendar {
  readonly timezone: string;

  private readonly formatter: Intl.DateTimeFormat;
  private readonly sessions: readonly NormalizedWindow[];
  private readonly holidays: ReadonlySet<string>;

  constructor(calendar: TradingCalendar) {
    if (!calendar || typeof calendar.timezone !== "string") {
      fail("INVALID_ARGUMENT", "calendar.timezone is required");
    }
    if (!Array.isArray(calendar.sessions) || calendar.sessions.length === 0) {
      fail("INVALID_ARGUMENT", "calendar.sessions must not be empty");
    }

    this.timezone = calendar.timezone;
    try {
      this.formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: calendar.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
    } catch {
      fail("INVALID_ARGUMENT", `Unknown calendar timezone: ${calendar.timezone}`);
    }

    this.sessions = calendar.sessions.map(normalizeWindow);
    this.holidays = new Set(calendar.holidays ?? []);
  }

  isOpen(time: number): boolean {
    return this.sessionAt(time) !== null;
  }

  sessionAt(time: number): SessionInterval | null {
    if (!Number.isFinite(time)) {
      return null;
    }

    const date = this.localDate(time);
    for (let offset = -7; offset <= 1; offset += 1) {
      const candidate = addDays(date.year, date.month, date.day, offset);
      for (const interval of this.intervalsForDate(
        candidate.year,
        candidate.month,
        candidate.day,
      )) {
        if (time >= interval.start && time < interval.end) {
          return interval;
        }
      }
    }

    return null;
  }

  sessionsBetween(from: number, to: number): SessionInterval[] {
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return [];
    }

    const first = this.localDate(from);
    const last = this.localDate(to + DAY);
    const firstDay = Date.UTC(first.year, first.month - 1, first.day) - 7 * DAY;
    const lastDay = Date.UTC(last.year, last.month - 1, last.day);
    const result: SessionInterval[] = [];

    for (let day = firstDay; day <= lastDay; day += DAY) {
      const date = new Date(day);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const dateOfMonth = date.getUTCDate();
      for (const interval of this.intervalsForDate(year, month, dateOfMonth)) {
        if (interval.end > from && interval.start < to) {
          result.push(interval);
        }
      }
    }

    result.sort((first, second) => first.start - second.start);
    return result;
  }

  private intervalsForDate(year: number, month: number, day: number): SessionInterval[] {
    const weekday = isoWeekday(year, month, day);
    const dateKey = key(year, month, day);
    if (this.holidays.has(dateKey)) {
      return [];
    }

    const result: SessionInterval[] = [];
    for (const session of this.sessions) {
      if (session.openDay !== weekday) {
        continue;
      }

      let closeOffset = (session.closeDay - session.openDay + 7) % 7;
      if (closeOffset === 0 && session.closeMinutes <= session.openMinutes) {
        closeOffset = 7;
      }

      const open = this.localToUtc(year, month, day, session.openMinutes);
      const closeDate = addDays(year, month, day, closeOffset);
      const close = this.localToUtc(
        closeDate.year,
        closeDate.month,
        closeDate.day,
        session.closeMinutes,
      );

      if (close > open) {
        result.push({ start: open, end: close });
      }
    }
    return result;
  }

  private localToUtc(year: number, month: number, day: number, minutes: number): number {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    let target = Date.UTC(year, month - 1, day, hour, minute);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const offsets = new Set([
        this.offsetAt(target - DAY),
        this.offsetAt(target),
        this.offsetAt(target + DAY),
      ]);
      const candidates = [...offsets]
        .map((offset) => target - offset)
        .filter((candidate) => this.matches(candidate, year, month, day, hour, minute))
        .sort((first, second) => first - second);

      if (candidates.length > 0) {
        return candidates[0]!;
      }
      target += HOUR;
      year = new Date(target).getUTCFullYear();
      month = new Date(target).getUTCMonth() + 1;
      day = new Date(target).getUTCDate();
    }

    fail("INVALID_ARGUMENT", "Could not resolve a local session time");
  }

  private matches(
    utc: number,
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
  ): boolean {
    const parts = this.localParts(utc);
    return (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute
    );
  }

  private offsetAt(utc: number): number {
    const parts = this.localParts(utc);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    return asUtc - Math.floor(utc / MINUTE) * MINUTE;
  }

  private localDate(time: number): LocalParts {
    return this.localParts(Math.floor(time / MINUTE) * MINUTE);
  }

  private localParts(time: number): LocalParts {
    const values: Record<string, number> = {};
    for (const part of this.formatter.formatToParts(new Date(time))) {
      if (part.type !== "literal") {
        values[part.type] = Number(part.value);
      }
    }
    return {
      year: values.year!,
      month: values.month!,
      day: values.day!,
      hour: values.hour!,
      minute: values.minute!,
    };
  }
}

function normalizeWindow(window: SessionWindow): NormalizedWindow {
  if (
    !Number.isInteger(window.openDay) ||
    window.openDay < 1 ||
    window.openDay > 7 ||
    !Number.isInteger(window.closeDay) ||
    window.closeDay < 1 ||
    window.closeDay > 7
  ) {
    fail("INVALID_ARGUMENT", "Session weekdays must be integers from 1 to 7");
  }

  return {
    openDay: window.openDay,
    openMinutes: parseTime(window.openTime),
    closeDay: window.closeDay,
    closeMinutes: parseTime(window.closeTime),
  };
}

function parseTime(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    fail("INVALID_ARGUMENT", `Invalid session time: ${value}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    fail("INVALID_ARGUMENT", `Invalid session time: ${value}`);
  }
  return hour * 60 + minute;
}

function isoWeekday(year: number, month: number, day: number): number {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function addDays(
  year: number,
  month: number,
  day: number,
  offset: number,
): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function key(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
