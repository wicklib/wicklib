import type { OhlcData } from "@wicklib/core";

import type {
  ScriptSandboxInputs,
  ScriptSandboxMetadata,
  ScriptSandboxOptions,
  ScriptSandboxResult,
} from "./sandbox";

/**
 * Requests accepted by the WickScript worker.
 */
export type ScriptWorkerRequest =
  | {
      type: "compile";
      requestId: number;
      source: string;
      inputs?: ScriptSandboxInputs;
      options?: ScriptSandboxOptions;
    }
  | {
      type: "run";
      requestId: number;
      sessionId: number;
      bars: readonly OhlcData[];
    }
  | {
      type: "dispose";
      requestId: number;
      sessionId: number;
    };

/**
 * Serializable failures returned by the WickScript worker.
 */
export interface SerializedScriptError {
  name: string;
  message: string;
  code?: string;
  barIndex?: number | null;
}

/**
 * Responses emitted by the WickScript worker.
 */
export type ScriptWorkerResponse =
  | {
      type: "compiled";
      requestId: number;
      sessionId: number;
      metadata: ScriptSandboxMetadata;
    }
  | {
      type: "result";
      requestId: number;
      result: ScriptSandboxResult;
    }
  | {
      type: "disposed";
      requestId: number;
    }
  | {
      type: "error";
      requestId: number;
      error: SerializedScriptError;
    };
