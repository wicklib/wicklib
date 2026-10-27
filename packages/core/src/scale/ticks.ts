const priceFormatters = new Map<string, Intl.NumberFormat>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

export interface PriceTick {
  value: number;
}

/**
 * Chooses "nice" price ticks for a range and target count.
 */
export function nicePriceTicks(min: number, max: number, target = 6): PriceTick[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [];
  }

  const span = max - min;
  const raw = span / Math.max(1, target);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = multiplier * magnitude;
  const start = Math.ceil(min / step) * step;
  const epsilon = step * 1e-9;

  const ticks: PriceTick[] = [];
  for (let value = start; value <= max + epsilon && ticks.length < 200; value += step) {
    ticks.push({ value: Number(value.toPrecision(12)) });
  }
  return ticks;
}

/**
 * Decimal precision implied by a tick step.
 */
export function precisionForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) {
    return 2;
  }
  return Math.max(0, Math.min(8, Math.ceil(-Math.log10(step))));
}

/**
 * Step implied by a range and a target tick count.
 */
export function stepForRange(min: number, max: number, target = 6): number {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) {
    return 0;
  }
  return span / Math.max(1, target);
}

export function formatPrice(value: number, precision: number, locale: string): string {
  const key = `${locale}|${precision}`;
  let formatter = priceFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
      useGrouping: true,
    });
    priceFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

const TIME_STEPS = [
  1_000,
  5_000,
  15_000,
  30_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  2 * 60 * 60_000,
  4 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
  7 * 24 * 60 * 60_000,
  30 * 24 * 60 * 60_000,
  90 * 24 * 60 * 60_000,
];

/**
 * Picks a tick interval so labels are at least ~80 CSS pixels apart.
 */
export function chooseTimeStep(spanMs: number, width: number): number {
  if (!Number.isFinite(spanMs) || spanMs <= 0 || width <= 0) {
    return 24 * 60 * 60_000;
  }

  const minimum = (spanMs * 80) / Math.max(1, width);
  for (const step of TIME_STEPS) {
    if (step >= minimum) {
      return step;
    }
  }
  return TIME_STEPS[TIME_STEPS.length - 1]!;
}

/**
 * Generates aligned tick timestamps within a range.
 */
export function generateTimeTicks(from: number, to: number, width: number): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return [];
  }

  const step = chooseTimeStep(to - from, width);
  let first = Math.ceil(from / step) * step;

  const day = 24 * 60 * 60_000;
  const monthStep = step === 90 * day ? 3 : step === 30 * day ? 1 : 0;

  if (step === 7 * day) {
    let candidate = Math.ceil(from / day) * day;
    while (new Date(candidate).getUTCDay() !== 1) {
      candidate += day;
    }
    first = candidate;
  } else if (monthStep > 0) {
    const date = new Date(from);
    first = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    while (first < from) {
      first = addMonths(first, monthStep);
    }
  }

  const ticks: number[] = [];
  if (monthStep > 0) {
    for (let time = first; time <= to && ticks.length < 200; time = addMonths(time, monthStep)) {
      ticks.push(time);
    }
    return ticks;
  }

  for (let time = first; time <= to && ticks.length < 200; time += step) {
    ticks.push(time);
  }
  return ticks;
}

export function formatTimeLabel(
  time: number,
  spanMs: number,
  locale: string,
  timezone: string,
  timeVisible: boolean,
  secondsVisible: boolean,
): string {
  const day = 24 * 60 * 60_000;

  let options: Intl.DateTimeFormatOptions;
  if (!timeVisible) {
    options = spanMs > 400 * day ? { year: "numeric" } : { month: "short", day: "numeric" };
  } else if (spanMs <= 2 * day) {
    options = secondsVisible
      ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" };
  } else if (spanMs <= 90 * day) {
    options = { month: "short", day: "numeric" };
  } else if (spanMs <= 2 * 365 * day) {
    options = { month: "short", year: "numeric" };
  } else {
    options = { year: "numeric" };
  }

  const key = `${locale}|${timezone}|${JSON.stringify(options)}`;
  let formatter = timeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone });
    timeFormatters.set(key, formatter);
  }
  return formatter.format(time);
}

export function formatCrosshairTime(
  time: number,
  locale: string,
  timezone: string,
  secondsVisible: boolean,
): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(secondsVisible ? { second: "2-digit" } : {}),
  };

  const key = `${locale}|${timezone}|${JSON.stringify(options)}`;
  let formatter = timeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone });
    timeFormatters.set(key, formatter);
  }
  return formatter.format(time);
}

function addMonths(time: number, months: number): number {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
}
