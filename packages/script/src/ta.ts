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
  stdev(context: ScriptContext, source: TaSeries, length: number): number | null;
  change(context: ScriptContext, source: TaSeries, length?: number): number | null;
  roc(context: ScriptContext, source: TaSeries, length?: number): number | null;
  cum(context: ScriptContext, source: TaSeries): number | null;
  vwma(context: ScriptContext, source: TaSeries, length: number): number | null;
  wma(context: ScriptContext, source: TaSeries, length: number): number | null;
  rma(context: ScriptContext, source: TaSeries, length: number): number | null;
  cci(context: ScriptContext, source: TaSeries, length: number): number | null;
  mfi(context: ScriptContext, length: number): number | null;
  wpr(context: ScriptContext, length: number): number | null;
  highestbars(context: ScriptContext, source: TaSeries, length: number): number | null;
  lowestbars(context: ScriptContext, source: TaSeries, length: number): number | null;
  tr(context: ScriptContext): number | null;
  obv(context: ScriptContext): number | null;
  linreg(context: ScriptContext, source: TaSeries, length: number): number | null;
  barssince(context: ScriptContext, condition: boolean, key: string): number | null;
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
  stdev: notImplemented("ta.stdev"),
  change: notImplemented("ta.change"),
  roc: notImplemented("ta.roc"),
  cum: notImplemented("ta.cum"),
  vwma: notImplemented("ta.vwma"),
  wma: notImplemented("ta.wma"),
  rma: notImplemented("ta.rma"),
  cci: notImplemented("ta.cci"),
  mfi: notImplemented("ta.mfi"),
  wpr: notImplemented("ta.wpr"),
  highestbars: notImplemented("ta.highestbars"),
  lowestbars: notImplemented("ta.lowestbars"),
  tr: notImplemented("ta.tr"),
  obv: notImplemented("ta.obv"),
  linreg: notImplemented("ta.linreg"),
  barssince: notImplemented("ta.barssince"),
  crossover: notImplemented("ta.crossover"),
  crossunder: notImplemented("ta.crossunder"),
};

function notImplemented(name: string): (...args: never[]) => never {
  return () => {
    throw new Error(`${SCRIPT_NOT_IMPLEMENTED}: ${name}`);
  };
}
