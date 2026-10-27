import type { OhlcStore } from "./data/ohlc-store";
import { fail, WickError } from "./errors";
import type {
  IndicatorApi,
  IndicatorBars,
  IndicatorDefinition,
  IndicatorInputDefinition,
  IndicatorInputValue,
  IndicatorInputs,
  IndicatorOutput,
  IndicatorPlotDefinition,
  IndicatorPlotOptions,
  SourceValue,
} from "./types";

const SOURCE_VALUES: readonly SourceValue[] = [
  "open",
  "high",
  "low",
  "close",
  "hl2",
  "hlc3",
  "ohlc4",
];

interface ResolvedPlotOptions {
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dotted" | "dashed";
  visible: boolean;
}

export interface IndicatorPlotRenderData {
  id: string;
  type: "line" | "histogram" | "area";
  values: Float64Array;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dotted" | "dashed";
  baseline: number;
  visible: boolean;
}

export interface IndicatorRenderData {
  id: string;
  title: string;
  plots: IndicatorPlotRenderData[];
}

export interface IndicatorHost {
  assertAlive(): void;
  getSourceStore(seriesId: string): OhlcStore | null;
  requestRender(): void;
  reportError(error: WickError): void;
  removeIndicator(indicator: Indicator): void;
}

/**
 * A live indicator instance. Owned by one pane; sources the primary series.
 */
export class Indicator<
  TInputs extends IndicatorInputs = IndicatorInputs,
> implements IndicatorApi<TInputs> {
  readonly id: string;
  readonly sourceSeriesId: string;
  readonly paneId: string;
  readonly definition: IndicatorDefinition<TInputs>;

  private readonly host: IndicatorHost;
  private readonly plotOptions: Record<string, ResolvedPlotOptions> = {};
  private inputs: TInputs;
  private values: Record<string, Float64Array> = {};
  private dirty = true;
  private removed = false;

  constructor(
    id: string,
    sourceSeriesId: string,
    paneId: string,
    definition: IndicatorDefinition<TInputs>,
    inputs: Partial<TInputs> | undefined,
    host: IndicatorHost,
  ) {
    this.id = id;
    this.sourceSeriesId = sourceSeriesId;
    this.paneId = paneId;
    this.definition = definition;
    this.host = host;
    this.inputs = resolveIndicatorInputs<TInputs>(definition.inputs, inputs);

    for (const plot of definition.plots) {
      this.plotOptions[plot.id] = resolvePlotOptions(plot);
    }
  }

  markDirty(): void {
    this.dirty = true;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  recompute(): void {
    this.dirty = false;

    const store = this.host.getSourceStore(this.sourceSeriesId);
    if (!store || store.length === 0) {
      this.values = {};
      return;
    }

    let output: IndicatorOutput;
    try {
      output = this.definition.compute({
        bars: store as IndicatorBars,
        inputs: Object.freeze({ ...this.inputs }) as Readonly<TInputs>,
      });
    } catch (error) {
      this.reportError("Indicator compute failed", error);
      return;
    }

    const knownPlots = new Set(this.definition.plots.map((plot) => plot.id));
    for (const key of Object.keys(output)) {
      if (!knownPlots.has(key)) {
        this.reportError(`Unknown plot id: ${key}`);
        return;
      }
    }

    const values: Record<string, Float64Array> = {};

    for (const plot of this.definition.plots) {
      const source = output[plot.id];
      if (source === undefined) {
        this.reportError(`Missing plot output: ${plot.id}`);
        return;
      }
      if (source.length !== store.length) {
        this.reportError(
          `Plot ${plot.id} expected ${store.length} values, received ${source.length}`,
        );
        return;
      }

      const array = new Float64Array(store.length);
      for (let index = 0; index < source.length; index += 1) {
        const value = source[index];
        if (value === null) {
          array[index] = Number.NaN;
        } else if (typeof value === "number" && Number.isFinite(value)) {
          array[index] = value;
        } else {
          this.reportError(`Plot ${plot.id} returned a non-finite value`);
          return;
        }
      }
      values[plot.id] = array;
    }

    this.values = values;
  }

  setInputs(inputs: Partial<TInputs>): void {
    this.assertAlive();
    this.inputs = resolveIndicatorInputs<TInputs>(this.definition.inputs, {
      ...this.inputs,
      ...inputs,
    });
    this.markDirty();
    this.host.requestRender();
  }

  setPlotOptions(plotId: string, options: IndicatorPlotOptions): void {
    this.assertAlive();

    const plot = this.definition.plots.find((candidate) => candidate.id === plotId);
    if (!plot) {
      fail("INVALID_ARGUMENT", `Unknown plot id: ${plotId}`);
    }

    const current = this.plotOptions[plotId]!;
    this.plotOptions[plotId] = {
      color: options.color ?? current.color,
      lineWidth: options.lineWidth ?? current.lineWidth,
      lineStyle: options.lineStyle ?? current.lineStyle,
      visible: options.visible ?? current.visible,
    };
    this.host.requestRender();
  }

  remove(): void {
    this.assertAlive();
    this.removed = true;
    this.host.removeIndicator(this);
  }

  destroyInternal(): void {
    this.removed = true;
  }

  private assertAlive(): void {
    this.host.assertAlive();
    if (this.removed) {
      fail("DISPOSED", "Indicator is disposed");
    }
  }

  minMax(first: number, last: number): { min: number; max: number } | null {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const values of Object.values(this.values)) {
      if (values.length === 0) {
        continue;
      }
      const from = Math.max(0, first);
      const to = Math.min(values.length - 1, last);
      for (let index = from; index <= to; index += 1) {
        const value = values[index]!;
        if (Number.isNaN(value)) {
          continue;
        }
        if (value < min) {
          min = value;
        }
        if (value > max) {
          max = value;
        }
      }
    }

    return min === Number.POSITIVE_INFINITY ? null : { min, max };
  }

  toRenderData(): IndicatorRenderData {
    return {
      id: this.id,
      title: this.definition.meta.name,
      plots: this.definition.plots.map((plot) => {
        const options = this.plotOptions[plot.id]!;
        return {
          id: plot.id,
          type: plot.type,
          values: this.values[plot.id] ?? new Float64Array(0),
          color: options.color,
          lineWidth: options.lineWidth,
          lineStyle: options.lineStyle,
          baseline: plot.baseline ?? 0,
          visible: options.visible,
        };
      }),
    };
  }

  private reportError(message: string, cause?: unknown): void {
    this.host.reportError(
      new WickError("INVALID_DATA", `${this.definition.meta.id}: ${message}`, {
        indicatorId: this.id,
        cause: cause === undefined ? undefined : String(cause),
      }),
    );
  }
}

/**
 * Merges defaults with overrides and validates every resolved input.
 */
export function resolveIndicatorInputs<TInputs extends IndicatorInputs>(
  definitions: readonly IndicatorInputDefinition[],
  overrides: Partial<TInputs> | undefined,
): TInputs {
  const known = new Set(definitions.map((definition) => definition.id));
  const overrideRecord = overrides as Record<string, IndicatorInputValue | undefined> | undefined;

  if (overrideRecord) {
    for (const key of Object.keys(overrideRecord)) {
      if (!known.has(key)) {
        fail("INVALID_ARGUMENT", `Unknown indicator input: ${key}`);
      }
    }
  }

  const result: Record<string, IndicatorInputValue> = {};

  for (const definition of definitions) {
    const value = overrideRecord?.[definition.id] ?? definition.defaultValue;

    if (definition.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        fail("INVALID_ARGUMENT", `${definition.id} must be a finite number`);
      }
      if (definition.min !== undefined && value < definition.min) {
        fail("INVALID_ARGUMENT", `${definition.id} must be at least ${definition.min}`);
      }
      if (definition.max !== undefined && value > definition.max) {
        fail("INVALID_ARGUMENT", `${definition.id} must be at most ${definition.max}`);
      }
    } else if (definition.type === "boolean") {
      if (typeof value !== "boolean") {
        fail("INVALID_ARGUMENT", `${definition.id} must be a boolean`);
      }
    } else if (definition.type === "source") {
      if (typeof value !== "string") {
        fail("INVALID_ARGUMENT", `${definition.id} must be a source string`);
      }
      const allowed = definition.options ?? SOURCE_VALUES;
      if (!allowed.includes(value)) {
        fail("INVALID_ARGUMENT", `${definition.id} has an invalid source: ${value}`);
      }
    } else {
      if (typeof value !== "string") {
        fail("INVALID_ARGUMENT", `${definition.id} must be a string`);
      }
      if (definition.options && !definition.options.includes(value)) {
        fail("INVALID_ARGUMENT", `${definition.id} has an invalid value: ${value}`);
      }
    }

    result[definition.id] = value;
  }

  return result as TInputs;
}

function resolvePlotOptions(plot: IndicatorPlotDefinition): ResolvedPlotOptions {
  return {
    color: plot.color ?? defaultPlotColor(plot.type),
    lineWidth: plot.lineWidth ?? 1,
    lineStyle: plot.lineStyle ?? "solid",
    visible: plot.visible ?? true,
  };
}

function defaultPlotColor(type: "line" | "histogram" | "area"): string {
  return type === "histogram" ? "#26a69a" : "#2962ff";
}
