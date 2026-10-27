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
  taError: ScriptRuntimeError | null;
  history: OhlcData[];
  taState: Map<string, unknown>;
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
      taError: null,
      history: [],
      taState: new Map(),
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
      const value = context.dump(valueHandle);
      if (value === null) {
        host.currentPlots.set(id, null);
        return context.undefined;
      }
      if (typeof value !== "number" || !Number.isFinite(value)) {
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

    registerTaFunctions(context, host);

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
      const globalIndex = this.host.history.length;
      this.host.currentBarIndex = globalIndex;
      this.host.currentPlots = new Map();
      this.host.currentAlerts = [];
      this.host.outputError = null;
      this.host.taError = null;
      this.host.history.push(bar);
      this.host.deadline = Date.now() + this.options.timeLimitMs;
      this.host.interrupts = 0;
      this.host.timedOut = false;

      const barHandle = this.context.newString(JSON.stringify(bar));
      const indexHandle = this.context.newNumber(globalIndex);
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

      if (this.host.taError) {
        throw this.host.taError;
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
          return {
            defineScript: (definition) => definition,
            ta: globalThis.__wickscript_ta,
          };
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

type PriceSource = "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4";

const SOURCES = new Set<string>(["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"]);

function registerTaFunctions(context: QuickJSContext, host: SandboxHostState): void {
  const register = (
    name: string,
    callback: (sourceHandle: QuickJSHandle, lengthHandle: QuickJSHandle) => QuickJSHandle,
  ): void => {
    const handle = context.newFunction(name, (_contextHandle, sourceHandle, lengthHandle) => {
      if (!sourceHandle || !lengthHandle) {
        setTaError(host, "ta.* requires source and length arguments");
        return context.null;
      }
      return callback(sourceHandle, lengthHandle);
    });
    context.setProp(context.global, name, handle);
    handle.dispose();
  };

  const source = (handle: QuickJSHandle): PriceSource | number | null => {
    if (context.typeof(handle) === "number") {
      const value = context.getNumber(handle);
      if (!Number.isFinite(value)) {
        setTaError(host, "ta.* source must be a finite number");
        return null;
      }
      return value;
    }
    if (context.typeof(handle) === "string") {
      const value = context.getString(handle);
      if (!SOURCES.has(value)) {
        setTaError(host, `Unknown ta.* source: ${value}`);
        return null;
      }
      return value as PriceSource;
    }
    setTaError(host, "ta.* source must be a source name or a number");
    return null;
  };

  const length = (handle: QuickJSHandle): number | null => {
    const value = context.getNumber(handle);
    if (!Number.isInteger(value) || value <= 0) {
      setTaError(host, "ta.* length must be a positive integer");
      return null;
    }
    return value;
  };

  const number = (value: number | null): QuickJSHandle =>
    value === null ? context.null : context.newNumber(value);

  register("__wickscript_ta_sma", (sourceHandle, lengthHandle) => {
    const series = source(sourceHandle);
    const period = length(lengthHandle);
    if (series === null || period === null) return context.null;
    return number(sma(host, series, period));
  });

  register("__wickscript_ta_ema", (sourceHandle, lengthHandle) => {
    const series = source(sourceHandle);
    const period = length(lengthHandle);
    if (series === null || period === null) return context.null;
    return number(ema(host, series, period));
  });

  register("__wickscript_ta_rsi", (sourceHandle, lengthHandle) => {
    const series = source(sourceHandle);
    const period = length(lengthHandle);
    if (series === null || period === null) return context.null;
    return number(rsi(host, series, period));
  });

  const taAtr = context.newFunction("__wickscript_ta_atr", (_contextHandle, lengthHandle) => {
    if (!lengthHandle) {
      setTaError(host, "ta.atr requires a length argument");
      return context.null;
    }
    const period = length(lengthHandle);
    if (period === null) return context.null;
    return number(atr(host, period));
  });
  context.setProp(context.global, "__wickscript_ta_atr", taAtr);
  taAtr.dispose();

  register("__wickscript_ta_highest", (sourceHandle, lengthHandle) => {
    const series = source(sourceHandle);
    const period = length(lengthHandle);
    if (series === null || period === null) return context.null;
    return number(extreme(host, series, period, "highest"));
  });

  register("__wickscript_ta_lowest", (sourceHandle, lengthHandle) => {
    const series = source(sourceHandle);
    const period = length(lengthHandle);
    if (series === null || period === null) return context.null;
    return number(extreme(host, series, period, "lowest"));
  });

  register("__wickscript_ta_stdev", (sourceHandle, lengthHandle) => {
    const series = source(sourceHandle);
    const period = length(lengthHandle);
    if (series === null || period === null) return context.null;
    return number(stdev(host, series, period));
  });

  const optionalPeriod = (handle: QuickJSHandle | undefined): number | null => {
    if (!handle) return 1;
    return length(handle);
  };

  const taChange = context.newFunction(
    "__wickscript_ta_change",
    (_contextHandle, sourceHandle, lengthHandle) => {
      if (!sourceHandle) {
        setTaError(host, "ta.change requires a source argument");
        return context.null;
      }
      const series = source(sourceHandle);
      const period = optionalPeriod(lengthHandle);
      if (series === null || period === null) return context.null;
      return number(change(host, series, period));
    },
  );
  context.setProp(context.global, "__wickscript_ta_change", taChange);
  taChange.dispose();

  const taRoc = context.newFunction(
    "__wickscript_ta_roc",
    (_contextHandle, sourceHandle, lengthHandle) => {
      if (!sourceHandle) {
        setTaError(host, "ta.roc requires a source argument");
        return context.null;
      }
      const series = source(sourceHandle);
      const period = optionalPeriod(lengthHandle);
      if (series === null || period === null) return context.null;
      return number(roc(host, series, period));
    },
  );
  context.setProp(context.global, "__wickscript_ta_roc", taRoc);
  taRoc.dispose();

  const taCum = context.newFunction("__wickscript_ta_cum", (_contextHandle, sourceHandle) => {
    if (!sourceHandle) {
      setTaError(host, "ta.cum requires a source argument");
      return context.null;
    }
    const series = source(sourceHandle);
    if (series === null) return context.null;
    return number(cum(host, series));
  });
  context.setProp(context.global, "__wickscript_ta_cum", taCum);
  taCum.dispose();

  const cross = (direction: "crossover" | "crossunder") => {
    return (
      _contextHandle: QuickJSHandle,
      firstHandle: QuickJSHandle,
      secondHandle: QuickJSHandle,
    ): QuickJSHandle => {
      const first = source(firstHandle);
      const second = source(secondHandle);
      if (first === null || second === null) return context.false;
      const currentFirst = valueAt(host, host.currentBarIndex, first);
      const currentSecond = valueAt(host, host.currentBarIndex, second);
      const previousFirst = valueAt(host, host.currentBarIndex - 1, first);
      const previousSecond = valueAt(host, host.currentBarIndex - 1, second);
      if (
        currentFirst === null ||
        currentSecond === null ||
        previousFirst === null ||
        previousSecond === null
      ) {
        return context.false;
      }
      return direction === "crossover"
        ? previousFirst <= previousSecond && currentFirst > currentSecond
          ? context.true
          : context.false
        : previousFirst >= previousSecond && currentFirst < currentSecond
          ? context.true
          : context.false;
    };
  };

  const crossover = context.newFunction("__wickscript_ta_crossover", cross("crossover"));
  context.setProp(context.global, "__wickscript_ta_crossover", crossover);
  crossover.dispose();
  const crossunder = context.newFunction("__wickscript_ta_crossunder", cross("crossunder"));
  context.setProp(context.global, "__wickscript_ta_crossunder", crossunder);
  crossunder.dispose();

  context
    .unwrapResult(
      context.evalCode(
        `globalThis.__wickscript_ta = Object.freeze({
          sma: __wickscript_ta_sma,
          ema: __wickscript_ta_ema,
          rsi: __wickscript_ta_rsi,
          atr: __wickscript_ta_atr,
          highest: __wickscript_ta_highest,
          lowest: __wickscript_ta_lowest,
          stdev: __wickscript_ta_stdev,
          change: __wickscript_ta_change,
          roc: __wickscript_ta_roc,
          cum: __wickscript_ta_cum,
          crossover: __wickscript_ta_crossover,
          crossunder: __wickscript_ta_crossunder,
        });`,
        "ta.js",
      ),
    )
    .dispose();
}

function setTaError(host: SandboxHostState, message: string): void {
  host.taError = new ScriptRuntimeError("INVALID_INPUT", message, host.currentBarIndex);
}

function valueAt(
  host: SandboxHostState,
  index: number,
  series: PriceSource | number,
): number | null {
  if (typeof series === "number") {
    return index < 0 ? null : series;
  }
  const bar = host.history[index];
  if (!bar) {
    return null;
  }
  switch (series) {
    case "open":
      return bar.open;
    case "high":
      return bar.high;
    case "low":
      return bar.low;
    case "close":
      return bar.close;
    case "hl2":
      return (bar.high + bar.low) / 2;
    case "hlc3":
      return (bar.high + bar.low + bar.close) / 3;
    case "ohlc4":
      return (bar.open + bar.high + bar.low + bar.close) / 4;
  }
}

function sma(host: SandboxHostState, series: PriceSource | number, period: number): number | null {
  const start = host.currentBarIndex - period + 1;
  if (start < 0) {
    return null;
  }
  let sum = 0;
  for (let index = start; index <= host.currentBarIndex; index += 1) {
    const value = valueAt(host, index, series);
    if (value === null) return null;
    sum += value;
  }
  return sum / period;
}

function ema(host: SandboxHostState, series: PriceSource | number, period: number): number | null {
  const key = `ema:${String(series)}:${period}`;
  const state = host.taState.get(key) as { index: number; value: number } | undefined;
  if (state?.index === host.currentBarIndex) {
    return state.value;
  }
  if (host.currentBarIndex < period - 1) {
    return null;
  }
  const current = valueAt(host, host.currentBarIndex, series);
  if (current === null) {
    return null;
  }
  const value =
    state && state.index < host.currentBarIndex
      ? (current - state.value) * (2 / (period + 1)) + state.value
      : sma(host, series, period);
  if (value === null) {
    return null;
  }
  host.taState.set(key, { index: host.currentBarIndex, value });
  return value;
}

function rsi(host: SandboxHostState, series: PriceSource | number, period: number): number | null {
  const key = `rsi:${String(series)}:${period}`;
  const state = host.taState.get(key) as { index: number; gain: number; loss: number } | undefined;
  if (state?.index === host.currentBarIndex) {
    return rsiValue(state.gain, state.loss);
  }
  if (host.currentBarIndex < period) {
    return null;
  }

  if (!state || state.index > host.currentBarIndex) {
    let gain = 0;
    let loss = 0;
    for (let index = host.currentBarIndex - period + 1; index <= host.currentBarIndex; index += 1) {
      const previous = valueAt(host, index - 1, series);
      const current = valueAt(host, index, series);
      if (previous === null || current === null) return null;
      const change = current - previous;
      if (change >= 0) gain += change;
      else loss -= change;
    }
    gain /= period;
    loss /= period;
    host.taState.set(key, { index: host.currentBarIndex, gain, loss });
    return rsiValue(gain, loss);
  }

  const previous = valueAt(host, host.currentBarIndex - 1, series);
  const current = valueAt(host, host.currentBarIndex, series);
  if (previous === null || current === null) return null;
  const change = current - previous;
  const gain = (state.gain * (period - 1) + Math.max(change, 0)) / period;
  const loss = (state.loss * (period - 1) + Math.max(-change, 0)) / period;
  host.taState.set(key, { index: host.currentBarIndex, gain, loss });
  return rsiValue(gain, loss);
}

function rsiValue(gain: number, loss: number): number {
  if (loss === 0) return 100;
  if (gain === 0) return 0;
  return 100 - 100 / (1 + gain / loss);
}

function atr(host: SandboxHostState, period: number): number | null {
  const key = `atr:${period}`;
  const state = host.taState.get(key) as { index: number; value: number } | undefined;
  if (state?.index === host.currentBarIndex) {
    return state.value;
  }
  const current = trueRange(host, host.currentBarIndex);
  if (current === null || host.currentBarIndex < period - 1) {
    return null;
  }
  let value: number;
  if (!state || state.index > host.currentBarIndex) {
    value = 0;
    for (let index = host.currentBarIndex - period + 1; index <= host.currentBarIndex; index += 1) {
      const range = trueRange(host, index);
      if (range === null) return null;
      value += range;
    }
    value /= period;
  } else {
    value = (state.value * (period - 1) + current) / period;
  }
  host.taState.set(key, { index: host.currentBarIndex, value });
  return value;
}

function trueRange(host: SandboxHostState, index: number): number | null {
  const bar = host.history[index];
  if (!bar) return null;
  const previous = host.history[index - 1];
  if (!previous) return bar.high - bar.low;
  return Math.max(
    bar.high - bar.low,
    Math.abs(bar.high - previous.close),
    Math.abs(bar.low - previous.close),
  );
}

function extreme(
  host: SandboxHostState,
  series: PriceSource | number,
  period: number,
  direction: "highest" | "lowest",
): number | null {
  const start = host.currentBarIndex - period + 1;
  if (start < 0) return null;
  let result = direction === "highest" ? -Infinity : Infinity;
  for (let index = start; index <= host.currentBarIndex; index += 1) {
    const value = valueAt(host, index, series);
    if (value === null) return null;
    result = direction === "highest" ? Math.max(result, value) : Math.min(result, value);
  }
  return result;
}

function stdev(
  host: SandboxHostState,
  series: PriceSource | number,
  period: number,
): number | null {
  const average = sma(host, series, period);
  if (average === null) return null;
  const start = host.currentBarIndex - period + 1;
  let variance = 0;
  for (let index = start; index <= host.currentBarIndex; index += 1) {
    const value = valueAt(host, index, series);
    if (value === null) return null;
    variance += (value - average) ** 2;
  }
  return Math.sqrt(variance / period);
}

function change(
  host: SandboxHostState,
  series: PriceSource | number,
  period: number,
): number | null {
  const current = valueAt(host, host.currentBarIndex, series);
  const previous = valueAt(host, host.currentBarIndex - period, series);
  return current === null || previous === null ? null : current - previous;
}

function roc(host: SandboxHostState, series: PriceSource | number, period: number): number | null {
  const current = valueAt(host, host.currentBarIndex, series);
  const previous = valueAt(host, host.currentBarIndex - period, series);
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function cum(host: SandboxHostState, series: PriceSource | number): number | null {
  const key = `cum:${String(series)}`;
  const state = host.taState.get(key) as { index: number; value: number } | undefined;
  if (state?.index === host.currentBarIndex) {
    return state.value;
  }
  const current = valueAt(host, host.currentBarIndex, series);
  if (current === null) return null;
  const value = (state?.value ?? 0) + current;
  host.taState.set(key, { index: host.currentBarIndex, value });
  return value;
}
