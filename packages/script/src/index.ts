import type { OhlcData, WickExtension } from "@wicklib/core";

import { SCRIPT_NOT_IMPLEMENTED, WICKSCRIPT_API_VERSION } from "./constants";
import type { ScriptContext } from "./authoring";

export { defineScript } from "./authoring";
export { ScriptError } from "./errors";
export type {
  BooleanScriptInput,
  NumberScriptInput,
  ScriptContext,
  ScriptDefinition,
  ScriptInputDefinition,
  ScriptInputMap,
  ScriptInputValues,
  ScriptPlotDefinition,
  ScriptPlotId,
  ScriptPlotType,
  SourceScriptInput,
  StringScriptInput,
} from "./authoring";
export type { ScriptErrorCode } from "./errors";
export { SCRIPT_NOT_IMPLEMENTED, WICKSCRIPT_API_VERSION };

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
 * Whether a script-callable function is free or requires a commercial license.
 */
export type ScriptFunctionLicense = "free" | "pro";

/**
 * Metadata for a script-callable function.
 */
export interface ScriptFunctionMeta {
  name: string;
  license: ScriptFunctionLicense;
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

/**
 * A bar accepted by the script runtime.
 */
export type ScriptBar = OhlcData;
