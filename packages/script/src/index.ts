import type { OhlcData, WickExtension } from "@wicklib/core";

/**
 * Version of the WickScript API surface. Scripts declare the version they target.
 */
export const WICKSCRIPT_API_VERSION = 1;

/**
 * Error code used by Phase 1 stubs.
 */
export const SCRIPT_NOT_IMPLEMENTED = "WICKLIB_NOT_IMPLEMENTED";

/**
 * A user-declared input.
 */
export interface ScriptInput {
  name: string;
  type: "number" | "boolean" | "string" | "source";
  defaultValue?: number | boolean | string;
}

/**
 * Per-bar execution context handed to a compiled script.
 */
export interface ScriptContext {
  /** The bar currently being evaluated. */
  readonly bar: OhlcData;
  /** Zero-based index of the bar in the replay. */
  readonly index: number;
  /** Resolved user inputs. */
  readonly inputs: Readonly<Record<string, number | boolean | string>>;
  /** Persistent per-script state that survives across bars. */
  readonly state: Map<string, unknown>;
  /** Emits a plot value for the current bar. */
  plot(seriesId: string, value: number | null): void;
  /** Emits an alert for the current bar. */
  alert(message: string): void;
}

/**
 * Output of a completed replay.
 */
export interface ScriptResult {
  plots: Readonly<Record<string, ReadonlyArray<number | null>>>;
  alerts: ReadonlyArray<string>;
}

/**
 * A compiled script, ready for replay and streaming.
 */
export interface CompiledScript {
  run(context: ScriptContext): void;
  dispose(): void;
}

/**
 * Compiles and executes WickScript sources.
 */
export interface ScriptRuntime {
  compile(source: string): Promise<CompiledScript>;
}

/**
 * Extension descriptor used to register a runtime with the core.
 */
export interface ScriptRuntimeExtension extends WickExtension {
  kind: "script-runtime";
  runtime: ScriptRuntime;
}

/**
 * Metadata for a script-callable function.
 */
export interface ScriptFunctionMeta {
  name: string;
  license: "free" | "pro";
}

/**
 * Implementation of a script-callable function.
 */
export type ScriptFunctionImpl = (...args: ReadonlyArray<number>) => number;

/**
 * Registers a script-callable function. `@wicklib/pro` uses this for premium `ta.*`
 * functions without making the script package depend on pro.
 */
export function registerScriptFunction(
  _name: string,
  _impl: ScriptFunctionImpl,
  _meta: ScriptFunctionMeta,
): void {
  throw new Error(`${SCRIPT_NOT_IMPLEMENTED}: registerScriptFunction`);
}
