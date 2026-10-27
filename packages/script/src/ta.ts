import type { SourceValue } from "@wicklib/core";

import type { ScriptContext } from "./authoring";
import { SCRIPT_NOT_IMPLEMENTED } from "./constants";

/**
 * A price source or a constant number accepted by a `ta.*` function.
 */
export type TaSeries = SourceValue | number;

/**
 * Deterministic technical-analysis helpers available inside WickScript.
 */
export interface ScriptTa {
  sma(context: ScriptContext, source: TaSeries, length: number): number | null;
  ema(context: ScriptContext, source: TaSeries, length: number): number | null;
  rsi(context: ScriptContext, source: TaSeries, length: number): number | null;
  atr(context: ScriptContext, length: number): number | null;
  highest(context: ScriptContext, source: TaSeries, length: number): number | null;
  lowest(context: ScriptContext, source: TaSeries, length: number): number | null;
  crossover(context: ScriptContext, first: TaSeries, second: TaSeries): boolean;
  crossunder(context: ScriptContext, first: TaSeries, second: TaSeries): boolean;
}

/**
 * Type-facing `ta` object. Execution is provided by the QuickJS worker realm.
 */
export const ta: ScriptTa = {
  sma: notImplemented("ta.sma"),
  ema: notImplemented("ta.ema"),
  rsi: notImplemented("ta.rsi"),
  atr: notImplemented("ta.atr"),
  highest: notImplemented("ta.highest"),
  lowest: notImplemented("ta.lowest"),
  crossover: notImplemented("ta.crossover"),
  crossunder: notImplemented("ta.crossunder"),
};

function notImplemented(name: string): (...args: never[]) => never {
  return () => {
    throw new Error(`${SCRIPT_NOT_IMPLEMENTED}: ${name}`);
  };
}
