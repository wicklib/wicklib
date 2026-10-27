import { fail } from "../errors";
import type { PriceRange, PriceScaleOptions } from "../types";
import {
  formatPrice,
  nicePriceTicks,
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
 * Linear price scale. Logarithmic mode is reserved and currently throws.
 */
export class PriceScale {
  private autoScale = DEFAULTS.autoScale;
  private invertScale = DEFAULTS.invertScale;
  private scaleMargins = DEFAULTS.scaleMargins;
  private borderVisible = DEFAULTS.borderVisible;

  private range: PriceRange = { min: 0, max: 1 };
  private autoRange: PriceRange = { min: 0, max: 1 };

  constructor(options: PriceScaleOptions = {}) {
    this.setOptions(options);
  }

  setOptions(options: PriceScaleOptions): void {
    if (options.mode !== undefined && options.mode !== "normal") {
      fail("NOT_IMPLEMENTED", "Logarithmic price scale is not implemented in Phase 2");
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

    if (this.autoScale) {
      this.range = this.autoRange;
    }
  }

  isAutoScale(): boolean {
    return this.autoScale;
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

    let span = max - min;
    if (span === 0) {
      span = Math.max(Math.abs(min) * 0.01, 1e-6);
    }

    this.autoRange = {
      min: min - span * this.scaleMargins.bottom,
      max: max + span * this.scaleMargins.top,
    };

    if (this.autoScale) {
      this.range = this.autoRange;
    }
  }

  setVisibleRange(range: PriceRange): void {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min) {
      fail("INVALID_ARGUMENT", "Price range must have finite values with max > min");
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
    const ratio = max === min ? 0.5 : (price - min) / (max - min);
    return this.invertScale ? top + ratio * height : top + height - ratio * height;
  }

  yToPrice(y: number, top: number, height: number): number {
    const { min, max } = this.range;
    const ratio = height === 0 ? 0.5 : (y - top) / height;
    const normalized = this.invertScale ? ratio : 1 - ratio;
    return min + normalized * (max - min);
  }

  ticks(height: number): PriceTick[] {
    const target = Math.max(2, Math.floor(height / 60));
    return nicePriceTicks(this.range.min, this.range.max, target);
  }

  precision(): number {
    const step = stepForRange(this.range.min, this.range.max, 6);
    return precisionForStep(step);
  }

  formatValue(value: number, locale: string): string {
    return formatPrice(value, this.precision(), locale);
  }
}
