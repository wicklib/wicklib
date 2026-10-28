import type { OhlcData } from "@wicklib/core";

import type { ScriptInputMap, ScriptPlotDefinition } from "./authoring";
import { ScriptError, type ScriptErrorCode } from "./errors";
import { ScriptRuntimeError, type ScriptRuntimeErrorCode } from "./runtime-errors";
import type { ScriptWorkerRequest, ScriptWorkerResponse } from "./worker-protocol";

/**
 * Resolved input values supplied by the host.
 */
export type ScriptInputs = Readonly<Record<string, number | boolean | string>>;

/**
 * Execution limits for a script session.
 */
export interface ScriptLimits {
  memoryLimitBytes?: number;
  maxStackSizeBytes?: number;
  timeLimitMs?: number;
  maxInterrupts?: number;
  maxAlertsPerBar?: number;
  maxAlertLength?: number;
}

/**
 * Options for compiling a script.
 */
export interface ScriptCompileOptions {
  inputs?: ScriptInputs;
  limits?: ScriptLimits;
}

/**
 * Metadata declared by a script.
 */
export interface ScriptMetadata {
  name?: string;
  inputs: ScriptInputMap;
  plots: readonly ScriptPlotDefinition[];
}

/**
 * One alert emitted by a script, bound to its bar.
 */
export interface ScriptAlertEvent {
  time: number;
  barIndex: number;
  message: string;
}

/**
 * Output of a completed replay or stream step.
 */
export interface ScriptResult {
  plots: Readonly<Record<string, ReadonlyArray<number | null>>>;
  alerts: ReadonlyArray<string>;
  alertEvents: ReadonlyArray<ScriptAlertEvent>;
}

/**
 * A compiled script session.
 */
export interface CompiledScript {
  readonly metadata: ScriptMetadata;
  /** Runs a bar history through the script and returns all outputs for those bars. */
  replay(bars: readonly OhlcData[]): Promise<ScriptResult>;
  /** Runs one realtime bar through the same execution path as replay. */
  stream(bar: OhlcData): Promise<ScriptResult>;
  dispose(): Promise<void>;
}

/**
 * Compiles and executes WickScript sources.
 */
export interface ScriptRuntime {
  compile(source: string, options?: ScriptCompileOptions): Promise<CompiledScript>;
  dispose(): void;
}

/**
 * The minimal worker interface required by the host client.
 */
export type ScriptWorkerPayload =
  | Omit<Extract<ScriptWorkerRequest, { type: "compile" }>, "requestId">
  | Omit<Extract<ScriptWorkerRequest, { type: "run" }>, "requestId">
  | Omit<Extract<ScriptWorkerRequest, { type: "dispose" }>, "requestId">;

export interface ScriptWorkerPort {
  postMessage(message: ScriptWorkerRequest): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<ScriptWorkerResponse>) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent<ScriptWorkerResponse>) => void,
  ): void;
  terminate?(): void;
}

interface PendingRequest {
  resolve: (response: ScriptWorkerResponse) => void;
  reject: (error: unknown) => void;
}

/**
 * Creates a script runtime backed by a WickScript worker.
 *
 * The caller owns worker construction; use the `@wicklib/script/worker` entry with the
 * bundler's worker helper.
 */
export function createScriptWorkerRuntime(worker: ScriptWorkerPort): ScriptRuntime {
  return new WorkerScriptRuntime(worker);
}

class WorkerScriptRuntime implements ScriptRuntime {
  private readonly worker: ScriptWorkerPort;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly onMessage = (event: MessageEvent<ScriptWorkerResponse>): void => {
    const request = this.pending.get(event.data.requestId);
    if (!request) {
      return;
    }
    this.pending.delete(event.data.requestId);
    request.resolve(event.data);
  };
  private nextRequestId = 1;
  private disposed = false;

  constructor(worker: ScriptWorkerPort) {
    this.worker = worker;
    this.worker.addEventListener("message", this.onMessage);
  }

  async compile(source: string, options: ScriptCompileOptions = {}): Promise<CompiledScript> {
    this.assertAlive();
    const response = await this.request({
      type: "compile",
      source,
      ...(options.inputs ? { inputs: options.inputs } : {}),
      ...(options.limits ? { options: options.limits } : {}),
    });
    if (response.type === "error") {
      throw deserializeError(response.error);
    }
    if (response.type !== "compiled") {
      throw new ScriptRuntimeError("RUNTIME_ERROR", "Unexpected worker response");
    }
    return new WorkerCompiledScript(
      this,
      response.sessionId,
      response.metadata as unknown as ScriptMetadata,
    );
  }

  async request(request: ScriptWorkerPayload): Promise<ScriptWorkerResponse> {
    this.assertAlive();
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    return new Promise<ScriptWorkerResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      try {
        this.worker.postMessage({ ...request, requestId } as ScriptWorkerRequest);
      } catch (error) {
        this.pending.delete(requestId);
        reject(error);
      }
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.worker.removeEventListener("message", this.onMessage);
    for (const { reject } of this.pending.values()) {
      reject(new ScriptRuntimeError("RUNTIME_ERROR", "Script runtime is disposed"));
    }
    this.pending.clear();
    this.worker.terminate?.();
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new ScriptRuntimeError("RUNTIME_ERROR", "Script runtime is disposed");
    }
  }
}

class WorkerCompiledScript implements CompiledScript {
  readonly metadata: ScriptMetadata;

  private readonly runtime: WorkerScriptRuntime;
  private readonly sessionId: number;
  private disposed = false;

  constructor(runtime: WorkerScriptRuntime, sessionId: number, metadata: ScriptMetadata) {
    this.runtime = runtime;
    this.sessionId = sessionId;
    this.metadata = metadata;
  }

  async replay(bars: readonly OhlcData[]): Promise<ScriptResult> {
    this.assertAlive();
    const response = await this.runtime.request({
      type: "run",
      sessionId: this.sessionId,
      bars,
    });
    if (response.type === "error") {
      throw deserializeError(response.error);
    }
    if (response.type !== "result") {
      throw new ScriptRuntimeError("RUNTIME_ERROR", "Unexpected worker response");
    }
    return response.result;
  }

  async stream(bar: OhlcData): Promise<ScriptResult> {
    return this.replay([bar]);
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const response = await this.runtime.request({
      type: "dispose",
      sessionId: this.sessionId,
    });
    if (response.type === "error") {
      throw deserializeError(response.error);
    }
  }

  private assertAlive(): void {
    if (this.disposed) {
      throw new ScriptRuntimeError("RUNTIME_ERROR", "Script session is disposed");
    }
  }
}

const RUNTIME_CODES = new Set<ScriptRuntimeErrorCode>([
  "RUNTIME_ERROR",
  "TIMEOUT",
  "MEMORY_LIMIT",
  "OUTPUT_LIMIT",
  "INVALID_INPUT",
  "REVISION_UNSUPPORTED",
]);

function deserializeError(error: {
  message: string;
  code?: string;
  barIndex?: number | null;
}): Error {
  if (error.code && RUNTIME_CODES.has(error.code as ScriptRuntimeErrorCode)) {
    return new ScriptRuntimeError(
      error.code as ScriptRuntimeErrorCode,
      error.message,
      error.barIndex ?? null,
    );
  }
  if (error.code) {
    return new ScriptError(error.code as ScriptErrorCode, error.message);
  }
  return new ScriptRuntimeError("RUNTIME_ERROR", error.message);
}
