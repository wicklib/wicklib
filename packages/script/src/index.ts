import type { OhlcData, WickExtension } from "@wicklib/core";

import { SCRIPT_NOT_IMPLEMENTED, WICKSCRIPT_API_VERSION } from "./constants";
import type { ScriptRuntime } from "./runtime";

export { defineScript } from "./authoring";
export { ScriptError } from "./errors";
export { ScriptRuntimeError } from "./runtime-errors";
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
export type { ScriptRuntimeErrorCode } from "./runtime-errors";
export { createScriptWorkerRuntime } from "./runtime";
export { ta } from "./ta";
export type { ScriptTa, TaSeries } from "./ta";
export { SCRIPT_NOT_IMPLEMENTED, WICKSCRIPT_API_VERSION };
export type {
  CompiledScript,
  ScriptCompileOptions,
  ScriptInputs,
  ScriptLimits,
  ScriptMetadata,
  ScriptResult,
  ScriptRuntime,
  ScriptWorkerPort,
} from "./runtime";

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
