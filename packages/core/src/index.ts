/**
 * Wicklib core public API.
 *
 * Phase 1 freezes this surface as typed stubs. Implementations land later without
 * changing the contract. Do not use `any`, and do not leak internal types.
 */

export { VERSION } from "./version";

/**
 * Milliseconds since the Unix epoch.
 */
export type Time = number;

/**
 * A single OHLC bar.
 */
export interface Bar {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * License tier attached to an extension.
 */
export type LicenseTier = "free" | "pro";

/**
 * Metadata every extension must provide.
 */
export interface ExtensionMeta {
  /** Stable, globally unique identifier, for example `com.wicklib.sma`. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Tier required to use this extension. */
  license: LicenseTier;
  /** Semver of the extension itself. */
  version: string;
}

/**
 * Kinds of extension the core can host.
 */
export type ExtensionKind = "series" | "indicator" | "drawing" | "script-runtime";

/**
 * Base contract for anything registered with the core.
 */
export interface WickExtension {
  kind: ExtensionKind;
  meta: ExtensionMeta;
}

/**
 * Registration payload without the discriminant; helper functions add `kind`.
 */
export type ExtensionRegistration = Omit<WickExtension, "kind">;

/**
 * Options accepted by {@link createChart}.
 */
export interface ChartOptions {
  /** Initial symbol. */
  symbol?: string;
  /** Initial interval, for example `1m` or `1D`. */
  interval?: string;
  /** Enable the crosshair. Defaults to true. */
  crosshair?: boolean;
}

/**
 * Events emitted by a chart.
 */
export type ChartEvent = "crosshair" | "visible-range" | "click" | "ready";

/**
 * A live chart instance.
 */
export interface Chart {
  /** Registers a series and returns its identifier. */
  addSeries(extension: WickExtension): string;
  /** Removes a series by identifier. */
  removeSeries(id: string): void;
  /** Adds a pane and returns its identifier. */
  addPane(): string;
  /** Replaces the datafeed used by the chart. */
  setDatafeed(datafeed: Datafeed): void;
  /** Subscribes to a chart event and returns an unsubscribe function. */
  subscribe(event: ChartEvent, listener: (payload: unknown) => void): () => void;
  /** Releases every resource owned by the chart. */
  destroy(): void;
}

/**
 * Range request for historical bars.
 */
export interface BarsRequest {
  symbol: string;
  interval: string;
  from: Time;
  to: Time;
}

/**
 * Historical bars returned by a datafeed.
 */
export interface BarsResponse {
  bars: Bar[];
  /** True when the feed has no data for the requested range. */
  noData?: boolean;
}

/**
 * Historical and realtime data contract supplied by the host application.
 */
export interface Datafeed {
  /** Loads historical bars for a request. */
  getBars(request: BarsRequest): Promise<BarsResponse>;
  /** Subscribes to realtime bars. Returns an unsubscribe function. */
  subscribeBars?(request: BarsRequest, onBar: (bar: Bar) => void): () => void;
}

/**
 * Features that can be licensed.
 */
export type Feature =
  "orderflow" | "volume-profile" | "panes" | "layouts" | "strategy" | "alerts" | "script-functions";

/**
 * Runtime license context exposed to pro extensions.
 */
export interface LicenseContext {
  /** Returns true when the active license grants the feature. */
  hasFeature(feature: Feature): boolean;
}

/**
 * Error code used by Phase 1 stubs.
 */
export const NOT_IMPLEMENTED = "WICKLIB_NOT_IMPLEMENTED";

/**
 * Creates a chart inside the given container.
 */
export function createChart(container: HTMLElement, options: ChartOptions = {}): Chart {
  void container;
  void options;
  throw new Error(`${NOT_IMPLEMENTED}: createChart`);
}

/**
 * Registers an extension with the core registry.
 */
export function registerExtension(extension: WickExtension): void {
  void extension;
  throw new Error(`${NOT_IMPLEMENTED}: registerExtension`);
}

/**
 * Registers a series type.
 */
export function registerSeriesType(registration: ExtensionRegistration): void {
  registerExtension({ ...registration, kind: "series" });
}

/**
 * Registers an indicator.
 */
export function registerIndicator(registration: ExtensionRegistration): void {
  registerExtension({ ...registration, kind: "indicator" });
}

/**
 * Registers a drawing tool.
 */
export function registerDrawingTool(registration: ExtensionRegistration): void {
  registerExtension({ ...registration, kind: "drawing" });
}

/**
 * Registers a script runtime, such as `@wicklib/script`.
 */
export function registerScriptRuntime(registration: ExtensionRegistration): void {
  registerExtension({ ...registration, kind: "script-runtime" });
}

/**
 * Throws when the active license does not grant the feature.
 */
export function assertFeature(context: LicenseContext, feature: Feature): void {
  if (!context.hasFeature(feature)) {
    throw new Error(`WICKLIB_LICENSE_REQUIRED: ${feature}`);
  }
}
