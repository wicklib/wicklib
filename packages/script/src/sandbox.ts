import type { OhlcData } from "@wicklib/core";
import {
  getQuickJS,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSRuntime,
} from "quickjs-emscripten";

import { compileSource } from "./compiler";
import { ScriptError } from "./errors";
import { ScriptRuntimeError } from "./runtime-errors";

const DEFAULT_OPTIONS: Required<ScriptSandboxOptions> = {
  memoryLimitBytes: 8 * 1024 * 1024,
  maxStackSizeBytes: 1024 * 1024,
  timeLimitMs: 100,
  maxInterrupts: 100_000,
  maxAlertsPerBar: 16,
  maxAlertLength: 1_000,
};

/**
 * Resource limits for a sandboxed script.
 */
export interface ScriptSandboxOptions {
  memoryLimitBytes?: number;
  maxStackSizeBytes?: number;
  timeLimitMs?: number;
  maxInterrupts?: number;
  maxAlertsPerBar?: number;
  maxAlertLength?: number;
}

/**
 * Resolved input values passed into a script.
 */
export type ScriptSandboxInputs = Readonly<Record<string, number | boolean | string>>;

/**
 * Plot and alert output from a sandbox run.
 */
export interface ScriptSandboxResult {
  plots: Readonly<Record<string, ReadonlyArray<number | null>>>;
  alerts: ReadonlyArray<string>;
}

export interface ScriptSandboxMetadata {
  name?: string;
  inputs: Record<string, { type: string; defaultValue?: unknown; min?: number; max?: number }>;
  plots: Array<{ id: string; title: string; type: string }>;
}

type ScriptMetadata = ScriptSandboxMetadata;

interface SandboxHostState {
  plotIds: Set<string>;
  currentPlots: Map<string, number | null>;
  currentAlerts: string[];
  currentBarIndex: number;
  outputError: ScriptRuntimeError | null;
  timedOut: boolean;
  deadline: number;
  interrupts: number;
}

/**
 * QuickJS-backed script executor.
 *
 * This class is internal until the worker host and public runtime are wired. It exists so
 * the sandbox, limits, and output semantics can be tested independently.
 */
export class ScriptSandbox {
  private readonly context: QuickJSContext;
  private readonly runtime: QuickJSRuntime;
  private readonly options: Required<ScriptSandboxOptions>;
  private readonly metadata: ScriptMetadata;
  private readonly onBar: QuickJSHandle;
  private readonly runBar: QuickJSHandle;
  private readonly host: SandboxHostState;
  private lastTime: number | null = null;
  private disposed = false;

  private constructor(
    options: Required<ScriptSandboxOptions>,
    metadata: ScriptMetadata,
    context: QuickJSContext,
    runtime: QuickJSRuntime,
    onBar: QuickJSHandle,
    runBar: QuickJSHandle,
    host: SandboxHostState,
  ) {
    this.options = options;
    this.metadata = metadata;
    this.context = context;
    this.runtime = runtime;
    this.onBar = onBar;
    this.runBar = runBar;
    this.host = host;
  }

  /**
   * Compiles source and creates a sandboxed QuickJS realm.
   */
  static async create(
    source: string,
    inputs: ScriptSandboxInputs = {},
    options: ScriptSandboxOptions = {},
  ): Promise<ScriptSandbox> {
    const resolved = { ...DEFAULT_OPTIONS, ...options };
    const compiled = compileSource(source);
    const module = await getQuickJS();
    const runtime = module.newRuntime();
    runtime.setMemoryLimit(resolved.memoryLimitBytes);
    runtime.setMaxStackSize(resolved.maxStackSizeBytes);

    const host: SandboxHostState = {
      plotIds: new Set<string>(),
      currentPlots: new Map(),
      currentAlerts: [],
      currentBarIndex: -1,
      outputError: null,
      timedOut: false,
      deadline: Number.POSITIVE_INFINITY,
      interrupts: 0,
    };
    runtime.setInterruptHandler(() => {
      host.interrupts += 1;
      if (host.interrupts > resolved.maxInterrupts || Date.now() > host.deadline) {
        host.timedOut = true;
        return true;
      }
      return false;
    });

    const context = runtime.newContext();

    const plot = context.newFunction("__wickscript_plot", (idHandle, valueHandle) => {
      const id = context.getString(idHandle);
      if (!host.plotIds.has(id)) {
        host.outputError = new ScriptRuntimeError(
          "OUTPUT_LIMIT",
          `Plot id is not declared: ${id}`,
          host.currentBarIndex,
        );
        return context.undefined;
      }
      if (host.currentPlots.has(id)) {
        host.outputError = new ScriptRuntimeError(
          "OUTPUT_LIMIT",
          `Plot id was emitted twice in one bar: ${id}`,
          host.currentBarIndex,
        );
        return context.undefined;
      }
      if (context.typeof(valueHandle) === "null") {
        host.currentPlots.set(id, null);
        return context.undefined;
      }
      const value = context.getNumber(valueHandle);
      if (!Number.isFinite(value)) {
        host.outputError = new ScriptRuntimeError(
          "OUTPUT_LIMIT",
          `Plot value must be finite or null: ${id}`,
          host.currentBarIndex,
        );
        return context.undefined;
      }
      host.currentPlots.set(id, value);
      return context.undefined;
    });
    context.setProp(context.global, "__wickscript_plot", plot);
    plot.dispose();

    const alert = context.newFunction("__wickscript_alert", (messageHandle) => {
      const message = context.getString(messageHandle);
      if (host.currentAlerts.length >= resolved.maxAlertsPerBar) {
        host.outputError = new ScriptRuntimeError(
          "OUTPUT_LIMIT",
          "Alert limit exceeded",
          host.currentBarIndex,
        );
        return context.undefined;
      }
      if (message.length > resolved.maxAlertLength) {
        host.outputError = new ScriptRuntimeError(
          "OUTPUT_LIMIT",
          "Alert string limit exceeded",
          host.currentBarIndex,
        );
        return context.undefined;
      }
      host.currentAlerts.push(message);
      return context.undefined;
    });
    context.setProp(context.global, "__wickscript_alert", alert);
    alert.dispose();

    host.deadline = Date.now() + resolved.timeLimitMs;
    try {
      context.unwrapResult(context.evalCode(moduleWrapper(compiled.code), "script.cjs")).dispose();
      host.deadline = Number.POSITIVE_INFINITY;

      const definition = context.unwrapResult(
        context.evalCode("globalThis.__wickscript_definition", "definition.js"),
      );
      const rawMetadata = context.unwrapResult(
        context.evalCode(
          `JSON.stringify({
            name: __wickscript_definition.name,
            inputs: __wickscript_definition.inputs ?? {},
            plots: __wickscript_definition.plots ?? [],
          })`,
          "metadata.js",
        ),
      );
      const metadata = JSON.parse(context.getString(rawMetadata)) as ScriptMetadata;
      rawMetadata.dispose();

      for (const item of metadata.plots) {
        host.plotIds.add(item.id);
      }
      const resolvedInputs = resolveInputs(metadata.inputs, inputs);
      context
        .unwrapResult(
          context.evalCode(
            `globalThis.__wickscript_inputs = ${JSON.stringify(resolvedInputs)};
           const __wickscript_definition = globalThis.__wickscript_definition;
           const __wickscript_state = new Map();
           const __wickscript_context = {
             bar: null,
             index: 0,
             inputs: Object.freeze(globalThis.__wickscript_inputs),
             state: __wickscript_state,
             plot: (id, value) => globalThis.__wickscript_plot(String(id), value === null ? null : Number(value)),
             alert: (message) => globalThis.__wickscript_alert(String(message)),
           };
           globalThis.__wickscript_run = (barJson, index) => {
             __wickscript_context.bar = Object.freeze(JSON.parse(barJson));
             __wickscript_context.index = index;
             __wickscript_definition.onBar(__wickscript_context);
           };`,
            "runtime.js",
          ),
        )
        .dispose();

      const onBar = context.getProp(definition, "onBar");
      definition.dispose();
      const runBar = context.getProp(context.global, "__wickscript_run");
      return new ScriptSandbox(resolved, metadata, context, runtime, onBar, runBar, host);
    } catch (error) {
      context.dispose();
      runtime.dispose();
      throw toRuntimeError(error, host.timedOut, -1);
    }
  }

  /**
   * Returns the script metadata declared by `defineScript`.
   */
  getMetadata(): ScriptSandboxMetadata {
    return structuredClone(this.metadata);
  }

  /**
   * Replays a bar history through the script and collects outputs.
   */
  run(bars: readonly OhlcData[]): ScriptSandboxResult {
    this.assertAlive();

    let previous = this.lastTime;
    for (let index = 0; index < bars.length; index += 1) {
      const time = bars[index]!.time;
      if (previous !== null && time <= previous) {
        throw new ScriptRuntimeError(
          "REVISION_UNSUPPORTED",
          "Streaming bars must have strictly increasing times; replay from the start to revise history",
          index,
        );
      }
      previous = time;
    }

    const plots: Record<string, Array<number | null>> = {};
    for (const item of this.metadata.plots) {
      plots[item.id] = [];
    }
    const alerts: string[] = [];

    for (let index = 0; index < bars.length; index += 1) {
      const bar = bars[index]!;
      this.host.currentBarIndex = index;
      this.host.currentPlots = new Map();
      this.host.currentAlerts = [];
      this.host.outputError = null;
      this.host.deadline = Date.now() + this.options.timeLimitMs;
      this.host.interrupts = 0;
      this.host.timedOut = false;

      const barHandle = this.context.newString(JSON.stringify(bar));
      const indexHandle = this.context.newNumber(index);
      try {
        const result = this.context.callFunction(
          this.runBar,
          this.context.undefined,
          barHandle,
          indexHandle,
        );
        this.context.unwrapResult(result).dispose();
      } catch (error) {
        throw toRuntimeError(error, this.host.timedOut, index);
      } finally {
        barHandle.dispose();
        indexHandle.dispose();
        this.host.deadline = Number.POSITIVE_INFINITY;
      }

      if (this.host.outputError) {
        throw this.host.outputError;
      }

      for (const item of this.metadata.plots) {
        plots[item.id]!.push(this.host.currentPlots.get(item.id) ?? null);
      }
      alerts.push(...this.host.currentAlerts);
      this.lastTime = bar.time;
    }

    return { plots, alerts };
  }

  /**
   * Releases the QuickJS context and runtime.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.runtime.removeInterruptHandler();
    this.onBar.dispose();
    this.runBar.dispose();
    this.context.dispose();
    this.runtime.dispose();
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new ScriptRuntimeError("RUNTIME_ERROR", "Script sandbox is disposed");
    }
  }
}

function moduleWrapper(code: string): string {
  return `
    (function () {
      const module = { exports: {} };
      const require = (name) => {
        if (name === "@wicklib/script") {
          return { defineScript: (definition) => definition };
        }
        throw new Error("Module import is not allowed: " + name);
      };
      (function (module, exports, require) {
${code}
      })(module, module.exports, require);
      globalThis.__wickscript_definition = module.exports.default;
      if (!globalThis.__wickscript_definition) {
        throw new Error("Script must default-export defineScript");
      }
    })();
  `;
}

function resolveInputs(
  definitions: ScriptMetadata["inputs"],
  provided: ScriptSandboxInputs,
): ScriptSandboxInputs {
  const resolved: Record<string, number | boolean | string> = {};
  for (const [name, definition] of Object.entries(definitions)) {
    const value = provided[name] ?? definition.defaultValue;
    if (definition.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new ScriptError("INVALID_DEFINITION", `Input ${name} must be a finite number`);
      }
      if (definition.min !== undefined && value < definition.min) {
        throw new ScriptError("INVALID_DEFINITION", `Input ${name} is below its minimum`);
      }
      if (definition.max !== undefined && value > definition.max) {
        throw new ScriptError("INVALID_DEFINITION", `Input ${name} is above its maximum`);
      }
      resolved[name] = value;
    } else if (definition.type === "boolean") {
      if (typeof value !== "boolean") {
        throw new ScriptError("INVALID_DEFINITION", `Input ${name} must be a boolean`);
      }
      resolved[name] = value;
    } else {
      if (typeof value !== "string") {
        throw new ScriptError("INVALID_DEFINITION", `Input ${name} must be a string`);
      }
      resolved[name] = value;
    }
  }
  return resolved;
}

function toRuntimeError(error: unknown, timedOut: boolean, barIndex: number): ScriptRuntimeError {
  if (timedOut) {
    return new ScriptRuntimeError("TIMEOUT", "Script execution timed out", barIndex);
  }
  const message = error instanceof Error ? error.message : "Script execution failed";
  if (/out of memory/i.test(message)) {
    return new ScriptRuntimeError("MEMORY_LIMIT", message, barIndex);
  }
  return new ScriptRuntimeError("RUNTIME_ERROR", message, barIndex);
}
