import { fail } from "./errors";
import type { Indicator } from "./indicator";
import { PriceScale } from "./scale/price-scale";
import type { Series } from "./series";
import type { PaneApi, PaneOptions, PriceScaleApi, PriceScaleOptions } from "./types";

export interface PaneRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface PaneHost {
  assertAlive(): void;
  requestRender(): void;
  relayout(): void;
  removePane(pane: Pane): void;
}

/**
 * One horizontal pane. Panes share the time axis; each owns a price scale.
 */
export class Pane implements PaneApi {
  readonly id: string;
  readonly priceScale: PriceScale;
  readonly priceScaleApi: PriceScaleApi;
  readonly series: Series[] = [];
  readonly indicators: Indicator[] = [];
  readonly autoCreated: boolean;

  preferredHeight: number | null;
  plot: PaneRect | null = null;

  private readonly host: PaneHost;

  constructor(
    id: string,
    options: PaneOptions,
    autoCreated: boolean,
    host: PaneHost,
    defaultPriceScale: PriceScaleOptions = {},
  ) {
    this.id = id;
    this.autoCreated = autoCreated;
    this.preferredHeight = options.height ?? null;
    this.host = host;
    this.priceScale = new PriceScale(options.priceScale ?? defaultPriceScale);

    this.priceScaleApi = {
      getVisibleRange: () => {
        host.assertAlive();
        return this.priceScale.getVisibleRange();
      },
      setVisibleRange: (range) => {
        host.assertAlive();
        this.priceScale.setVisibleRange(range);
        host.requestRender();
      },
      setAutoScale: (enabled) => {
        host.assertAlive();
        this.priceScale.setAutoScale(enabled);
        host.requestRender();
      },
      isAutoScale: () => {
        host.assertAlive();
        return this.priceScale.isAutoScale();
      },
    };
  }

  setHeight(height: number): void {
    this.host.assertAlive();
    if (!Number.isFinite(height) || height <= 0) {
      fail("INVALID_ARGUMENT", "Pane height must be a positive finite number");
    }
    this.preferredHeight = height;
    this.host.relayout();
    this.host.requestRender();
  }

  remove(): void {
    this.host.assertAlive();
    this.host.removePane(this);
  }
}
