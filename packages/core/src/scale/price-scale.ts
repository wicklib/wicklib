import { fail } from "../errors";
import type { PriceFormatOptions, PriceRange, PriceScaleOptions } from "../types";
import {
  formatPrice,
  logarithmicPriceTicks,
  nicePriceTicks,
  precisionForMinMove,
  precisionForStep,
  stepForRange,
  type PriceTick,
} from "./ticks";

interface ResolvedOptions {
  autoScale: boolean;
  invertScale: boolean;
  scaleMargins: { top: number; bottom: number };
  borderVisible: boolean;
}

const DEFAULTS: ResolvedOptions = {
  autoScale: true,
  invertScale: false,
  scaleMargins: { top: 0.1, bottom: 0.1 },
  borderVisible: true,
};

/**
 * Linear or logarithmic price scale.
 */
export class PriceScale {
  private mode: "normal" | "logarithmic" = "normal";
  private autoScale = DEFAULTS.autoScale;
  private invertScale = DEFAULTS.invertScale;
  private scaleMargins = DEFAULTS.scaleMargins;
  private borderVisible = DEFAULTS.borderVisible;
  private priceFormat: PriceFormatOptions = {};

  private range: PriceRange = { min: 0, max: 1 };
  private autoRange: PriceRange = { min: 0, max: 1 };

  constructor(options: PriceScaleOptions = {}) {
    this.setOptions(options);
  }

  setOptions(options: PriceScaleOptions): void {
    if (options.mode !== undefined) {
      this.mode = options.mode;
    }
    if (options.autoScale !== undefined) {
      this.autoScale = options.autoScale;
    }
    if (options.invertScale !== undefined) {
      this.invertScale = options.invertScale;
    }
    if (options.borderVisible !== undefined) {
      this.borderVisible = options.borderVisible;
    }
    if (options.scaleMargins !== undefined) {
      const { top, bottom } = options.scaleMargins;
      if (
        !Number.isFinite(top) ||
        !Number.isFinite(bottom) ||
        top < 0 ||
        bottom < 0 ||
        top + bottom >= 1
      ) {
        fail(
          "INVALID_ARGUMENT",
          "scaleMargins must be finite, non-negative, and sum to less than 1",
        );
      }
      this.scaleMargins = { top, bottom };
    }
    if (options.priceFormat !== undefined) {
      const priceFormat = validatePriceFormat(options.priceFormat);
      this.priceFormat = { ...this.priceFormat, ...priceFormat };
    }

    if (this.autoScale) {
      this.range = this.autoRange;
    }
    if (this.mode === "logarithmic") {
      if (!this.autoScale && this.range.min <= 0) {
        fail("INVALID_ARGUMENT", "Logarithmic price range must be positive");
      }
      this.ensurePositiveRanges();
    }
  }

  isAutoScale(): boolean {
    return this.autoScale;
  }

  isLogarithmic(): boolean {
    return this.mode === "logarithmic";
  }

  isBorderVisible(): boolean {
    return this.borderVisible;
  }

  getVisibleRange(): PriceRange {
    return { ...this.range };
  }

  setAutoRange(min: number, max: number): void {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return;
    }

    if (max < min) {
      [min, max] = [max, min];
    }

    if (this.mode === "logarithmic") {
      if (min <= 0 || max <= 0) {
        return;
      }

      let span = Math.log(max) - Math.log(min);
      if (span === 0) {
        span = Math.max(Math.abs(Math.log(min)) * 0.01, 1e-6);
      }

      this.autoRange = {
        min: Math.exp(Math.log(min) - span * this.scaleMargins.bottom),
        max: Math.exp(Math.log(max) + span * this.scaleMargins.top),
      };
    } else {
      let span = max - min;
      if (span === 0) {
        span = Math.max(Math.abs(min) * 0.01, 1e-6);
      }

      this.autoRange = {
        min: min - span * this.scaleMargins.bottom,
        max: max + span * this.scaleMargins.top,
      };
    }

    if (this.autoScale) {
      this.range = this.autoRange;
    }
  }

  setVisibleRange(range: PriceRange): void {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min) {
      fail("INVALID_ARGUMENT", "Price range must have finite values with max > min");
    }
    if (this.mode === "logarithmic" && range.min <= 0) {
      fail("INVALID_ARGUMENT", "Logarithmic price range must be positive");
    }
    this.range = { min: range.min, max: range.max };
    this.autoScale = false;
  }

  setAutoScale(enabled: boolean): void {
    this.autoScale = enabled;
    if (enabled) {
      this.range = this.autoRange;
    }
  }

  priceToY(price: number, top: number, height: number): number {
    const { min, max } = this.range;
    if (this.mode === "logarithmic" && (min <= 0 || max <= 0)) {
      return top + (this.invertScale ? 0 : height);
    }
    if (this.mode === "logarithmic" && price <= 0) {
      return top + (this.invertScale ? 0 : height);
    }

    const ratio =
      max === min
        ? 0.5
        : this.mode === "logarithmic"
          ? (Math.log(price) - Math.log(min)) / (Math.log(max) - Math.log(min))
          : (price - min) / (max - min);
    return this.invertScale ? top + ratio * height : top + height - ratio * height;
  }

  yToPrice(y: number, top: number, height: number): number {
    const { min, max } = this.range;
    const ratio = height === 0 ? 0.5 : (y - top) / height;
    const normalized = this.invertScale ? ratio : 1 - ratio;
    if (this.mode === "logarithmic" && min > 0 && max > 0) {
      return Math.exp(Math.log(min) + normalized * (Math.log(max) - Math.log(min)));
    }
    return min + normalized * (max - min);
  }

  ticks(height: number): PriceTick[] {
    const target = Math.max(2, Math.floor(height / 30));
    return this.mode === "logarithmic"
      ? logarithmicPriceTicks(this.range.min, this.range.max, target)
      : nicePriceTicks(this.range.min, this.range.max, target);
  }

  precision(): number {
    if (this.priceFormat.precision !== undefined) {
      return this.priceFormat.precision;
    }
    if (this.priceFormat.minMove !== undefined) {
      return precisionForMinMove(this.priceFormat.minMove);
    }

    if (this.mode === "logarithmic") {
      const ticks = logarithmicPriceTicks(this.range.min, this.range.max, 6);
      if (ticks.length > 0) {
        return Math.min(12, Math.max(...ticks.map((tick) => precisionForMinMove(tick.value))));
      }
      return precisionForMinMove(this.range.min);
    }

    const step = stepForRange(this.range.min, this.range.max, 6);
    return precisionForStep(step);
  }

  formatValue(value: number, locale: string): string {
    return formatPrice(value, this.precision(), locale);
  }

  getOptions(): PriceScaleOptions {
    return {
      mode: this.mode,
      autoScale: this.autoScale,
      invertScale: this.invertScale,
      scaleMargins: { ...this.scaleMargins },
      borderVisible: this.borderVisible,
      priceFormat: { ...this.priceFormat },
    };
  }

  private ensurePositiveRanges(): void {
    if (this.autoRange.min <= 0 || this.autoRange.max <= this.autoRange.min) {
      this.autoRange = { min: 1, max: 10 };
    }
    if (this.range.min <= 0 || this.range.max <= this.range.min) {
      this.range = { ...this.autoRange };
    }
  }
}

function validatePriceFormat(options: PriceFormatOptions): PriceFormatOptions {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    fail("INVALID_ARGUMENT", "priceFormat must be an object");
  }

  const result: PriceFormatOptions = {};
  if (options.precision !== undefined) {
    if (!Number.isInteger(options.precision) || options.precision < 0 || options.precision > 12) {
      fail("INVALID_ARGUMENT", "priceFormat.precision must be an integer from 0 to 12");
    }
    result.precision = options.precision;
  }
  if (options.minMove !== undefined) {
    if (!Number.isFinite(options.minMove) || options.minMove <= 0) {
      fail("INVALID_ARGUMENT", "priceFormat.minMove must be a positive finite number");
    }
    result.minMove = options.minMove;
  }
  return result;
}
