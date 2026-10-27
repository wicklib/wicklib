import { fail } from "../errors";
import type {
  ChartOptions,
  CrosshairLineOptions,
  CrosshairOptions,
  GridOptions,
  InteractionOptions,
  LayoutOptions,
  PriceScaleOptions,
  TimeScaleOptions,
} from "../types";

type LightweightLineStyle =
  "solid" | "dotted" | "dashed" | "largeDashed" | "sparseDotted" | 0 | 1 | 2 | 3 | 4;

interface LightweightLineOptions {
  color?: string;
  width?: number;
  style?: LightweightLineStyle;
  visible?: boolean;
  labelBackgroundColor?: string;
}

interface LightweightBackground {
  type?: number | string;
  color?: string;
}

/**
 * The subset of lightweight-charts chart options understood by the migration mapper.
 * Unknown fields are ignored.
 */
export interface LightweightChartOptions {
  autoSize?: boolean;
  width?: number;
  height?: number;
  layout?: {
    background?: string | LightweightBackground;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
  };
  grid?: {
    vertLines?: { color?: string };
    horzLines?: { color?: string };
  };
  crosshair?: {
    mode?: 0 | 1 | 2 | "normal" | "magnet" | "hidden";
    vertLine?: LightweightLineOptions;
    horzLine?: LightweightLineOptions;
  };
  rightPriceScale?: {
    borderVisible?: boolean;
    autoScale?: boolean;
    invertScale?: boolean;
    scaleMargins?: { top?: number; bottom?: number };
    mode?: 0 | 1 | 2 | 3 | "normal" | "logarithmic" | "percentage" | "indexedTo100";
  };
  timeScale?: {
    barSpacing?: number;
    rightOffset?: number;
    minBarSpacing?: number;
    maxBarSpacing?: number;
    timeVisible?: boolean;
    secondsVisible?: boolean;
    borderVisible?: boolean;
  };
  handleScroll?: {
    mouseWheel?: boolean;
    pressedMouseMove?: boolean;
    horzTouchDrag?: boolean;
    vertTouchDrag?: boolean;
  };
  handleScale?: {
    mouseWheel?: boolean;
    pinch?: boolean;
    axisPressedMouseMove?: boolean;
    axisDoubleClickReset?: boolean;
  };
  localization?: {
    locale?: string;
  };
  [key: string]: unknown;
}

/**
 * Maps the supported lightweight-charts options onto Wicklib chart options.
 *
 * Unsupported features are rejected rather than silently approximated. Wheel input is
 * chart-wide, so disabling either lightweight-charts wheel path disables both pan and zoom.
 */
export function mapLightweightChartOptions(options: LightweightChartOptions): ChartOptions {
  const result: ChartOptions = {};

  if (options.autoSize !== undefined) {
    result.autoSize = options.autoSize;
  }
  if (options.width !== undefined) {
    result.width = options.width;
  }
  if (options.height !== undefined) {
    result.height = options.height;
  }
  if (options.localization?.locale !== undefined) {
    result.locale = options.localization.locale;
  }

  const layout: LayoutOptions = {};
  const background = mapBackground(options.layout?.background);
  if (background !== undefined) {
    layout.background = background;
  }
  if (options.layout?.textColor !== undefined) {
    layout.textColor = options.layout.textColor;
  }
  if (options.layout?.fontSize !== undefined) {
    layout.fontSize = options.layout.fontSize;
  }
  if (Object.keys(layout).length > 0) {
    result.layout = layout;
  }

  const grid: GridOptions = {};
  if (options.grid?.vertLines?.color !== undefined) {
    grid.vertLines = { color: options.grid.vertLines.color };
  }
  if (options.grid?.horzLines?.color !== undefined) {
    grid.horzLines = { color: options.grid.horzLines.color };
  }
  if (Object.keys(grid).length > 0) {
    result.grid = grid;
  }

  const crosshair: CrosshairOptions = {};
  const mode = mapCrosshairMode(options.crosshair?.mode);
  if (mode !== undefined) {
    crosshair.mode = mode;
  }
  const vertLine = mapLine(options.crosshair?.vertLine);
  if (vertLine) {
    crosshair.vertLine = vertLine;
  }
  const horzLine = mapLine(options.crosshair?.horzLine);
  if (horzLine) {
    crosshair.horzLine = horzLine;
  }
  const labelBackground =
    options.crosshair?.vertLine?.labelBackgroundColor ??
    options.crosshair?.horzLine?.labelBackgroundColor;
  if (labelBackground !== undefined) {
    crosshair.labelBackground = labelBackground;
  }
  if (Object.keys(crosshair).length > 0) {
    result.crosshair = crosshair;
  }

  const interaction: InteractionOptions = {
    wheel: !(
      options.handleScroll?.mouseWheel === false || options.handleScale?.mouseWheel === false
    ),
    drag:
      options.handleScroll?.pressedMouseMove !== false ||
      options.handleScroll?.horzTouchDrag !== false,
    pinch: options.handleScale?.pinch !== false,
    axisDrag: options.handleScale?.axisPressedMouseMove !== false,
    axisDoubleClickReset: options.handleScale?.axisDoubleClickReset !== false,
  };
  result.interaction = interaction;

  const priceScale: PriceScaleOptions = {};
  if (options.rightPriceScale?.borderVisible !== undefined) {
    priceScale.borderVisible = options.rightPriceScale.borderVisible;
  }
  if (options.rightPriceScale?.autoScale !== undefined) {
    priceScale.autoScale = options.rightPriceScale.autoScale;
  }
  if (options.rightPriceScale?.invertScale !== undefined) {
    priceScale.invertScale = options.rightPriceScale.invertScale;
  }
  const margins = options.rightPriceScale?.scaleMargins;
  if (margins?.top !== undefined && margins.bottom !== undefined) {
    priceScale.scaleMargins = { top: margins.top, bottom: margins.bottom };
  }
  const priceMode = mapPriceMode(options.rightPriceScale?.mode);
  if (priceMode !== undefined) {
    priceScale.mode = priceMode;
  }
  if (Object.keys(priceScale).length > 0) {
    result.priceScale = priceScale;
  }

  const timeScale: TimeScaleOptions = {};
  copyDefined(timeScale, "barSpacing", options.timeScale?.barSpacing);
  copyDefined(timeScale, "rightOffset", options.timeScale?.rightOffset);
  copyDefined(timeScale, "minBarSpacing", options.timeScale?.minBarSpacing);
  copyDefined(timeScale, "maxBarSpacing", options.timeScale?.maxBarSpacing);
  copyDefined(timeScale, "timeVisible", options.timeScale?.timeVisible);
  copyDefined(timeScale, "secondsVisible", options.timeScale?.secondsVisible);
  copyDefined(timeScale, "borderVisible", options.timeScale?.borderVisible);
  if (Object.keys(timeScale).length > 0) {
    result.timeScale = timeScale;
  }

  return result;
}

function mapBackground(background: string | LightweightBackground | undefined): string | undefined {
  if (background === undefined) {
    return undefined;
  }
  if (typeof background === "string") {
    return background;
  }
  return background.color;
}

function mapCrosshairMode(
  mode: 0 | 1 | 2 | "normal" | "magnet" | "hidden" | undefined,
): CrosshairOptions["mode"] | undefined {
  if (mode === undefined) {
    return undefined;
  }
  if (mode === 0) {
    return "normal";
  }
  if (mode === 1) {
    return "magnet";
  }
  if (mode === 2) {
    return "hidden";
  }
  return mode;
}

function mapLine(line: LightweightLineOptions | undefined): CrosshairLineOptions | undefined {
  if (!line) {
    return undefined;
  }
  const result: CrosshairLineOptions = {};
  if (line.color !== undefined) {
    result.color = line.color;
  }
  if (line.width !== undefined) {
    result.width = line.width;
  }
  if (line.visible !== undefined) {
    result.visible = line.visible;
  }
  const style = mapLineStyle(line.style);
  if (style !== undefined) {
    result.style = style;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function mapLineStyle(
  style: LightweightLineStyle | undefined,
): CrosshairLineOptions["style"] | undefined {
  if (style === undefined) {
    return undefined;
  }
  if (style === 0) {
    return "solid";
  }
  if (style === 1 || style === 4) {
    return "dotted";
  }
  if (style === 2 || style === 3) {
    return "dashed";
  }
  if (style === "largeDashed") {
    return "dashed";
  }
  if (style === "sparseDotted") {
    return "dotted";
  }
  if (style === "solid" || style === "dotted" || style === "dashed") {
    return style;
  }
  return undefined;
}

function mapPriceMode(
  mode: 0 | 1 | 2 | 3 | "normal" | "logarithmic" | "percentage" | "indexedTo100" | undefined,
): PriceScaleOptions["mode"] | undefined {
  if (mode === undefined) {
    return undefined;
  }
  if (mode === 0 || mode === "normal") {
    return "normal";
  }
  if (mode === 1 || mode === "logarithmic") {
    return "logarithmic";
  }
  fail("NOT_IMPLEMENTED", "Only normal and logarithmic price scales are supported");
}

function copyDefined<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
