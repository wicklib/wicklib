import type { OhlcData, SourceValue } from "@wicklib/core";

import { ScriptError } from "./errors";

/**
 * Declares the value produced by a script input.
 */
export interface NumberScriptInput {
  readonly type: "number";
  readonly title?: string;
  readonly defaultValue: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

/**
 * Declares a boolean script input.
 */
export interface BooleanScriptInput {
  readonly type: "boolean";
  readonly title?: string;
  readonly defaultValue: boolean;
}

/**
 * Declares a string script input.
 */
export interface StringScriptInput {
  readonly type: "string";
  readonly title?: string;
  readonly defaultValue: string;
  readonly options?: readonly string[];
}

/**
 * Declares an OHLC source input.
 */
export interface SourceScriptInput {
  readonly type: "source";
  readonly title?: string;
  readonly defaultValue: SourceValue;
  readonly options?: readonly SourceValue[];
}

/**
 * One declared script input.
 */
export type ScriptInputDefinition =
  NumberScriptInput | BooleanScriptInput | StringScriptInput | SourceScriptInput;

/**
 * A script's declared inputs.
 */
export type ScriptInputMap = Readonly<Record<string, ScriptInputDefinition>>;

/**
 * Resolved input values inferred from their declarations.
 */
export type ScriptInputValues<TInputs extends ScriptInputMap> = {
  readonly [K in keyof TInputs]: TInputs[K] extends NumberScriptInput
    ? number
    : TInputs[K] extends BooleanScriptInput
      ? boolean
      : TInputs[K] extends SourceScriptInput
        ? SourceValue
        : string;
};

/**
 * Supported plot renderers.
 */
export type ScriptPlotType = "line" | "histogram" | "area";

/**
 * Declares one stable script output series.
 */
export interface ScriptPlotDefinition {
  readonly id: string;
  readonly title: string;
  readonly type: ScriptPlotType;
  readonly color?: string;
  readonly lineWidth?: number;
}

/**
 * Union of plot ids declared by a script.
 */
export type ScriptPlotId<TPlots extends readonly ScriptPlotDefinition[]> = TPlots[number]["id"];

/**
 * Per-bar context passed to {@link ScriptDefinition.onBar}.
 */
export interface ScriptContext<
  TInputs extends ScriptInputMap = ScriptInputMap,
  TPlotId extends string = string,
> {
  /** Current OHLCV bar. */
  readonly bar: Readonly<OhlcData>;
  /** Zero-based index in the replay. */
  readonly index: number;
  /** Resolved, immutable inputs. */
  readonly inputs: ScriptInputValues<TInputs>;
  /** Persistent state for the current script run. */
  readonly state: Map<string, unknown>;
  /** Emits one value for the current bar. */
  plot(seriesId: TPlotId, value: number | null): void;
  /** Emits an alert for the current bar. */
  alert(message: string): void;
}

/**
 * A complete script definition returned by {@link defineScript}.
 */
export interface ScriptDefinition<
  TInputs extends ScriptInputMap = ScriptInputMap,
  TPlots extends readonly ScriptPlotDefinition[] = readonly ScriptPlotDefinition[],
> {
  readonly name?: string;
  readonly inputs: TInputs;
  readonly plots: TPlots;
  readonly onBar: (context: ScriptContext<TInputs, ScriptPlotId<TPlots>>) => void;
}

/**
 * Declares a WickScript entry point.
 *
 * Scripts must export the returned definition as their default export.
 */
export function defineScript<
  const TInputs extends ScriptInputMap,
  const TPlots extends readonly ScriptPlotDefinition[],
>(definition: ScriptDefinition<TInputs, TPlots>): ScriptDefinition<TInputs, TPlots> {
  const plotIds = new Set<string>();
  for (const plot of definition.plots) {
    if (plot.id.trim() === "") {
      throw new ScriptError("INVALID_DEFINITION", "Plot ids must not be empty");
    }
    if (plotIds.has(plot.id)) {
      throw new ScriptError("INVALID_DEFINITION", `Duplicate plot id: ${plot.id}`);
    }
    plotIds.add(plot.id);
  }

  return Object.freeze({
    ...definition,
    inputs: Object.freeze({ ...definition.inputs }),
    plots: Object.freeze([...definition.plots]),
  }) as unknown as ScriptDefinition<TInputs, TPlots>;
}
