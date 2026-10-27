import type { OhlcData } from "@wicklib/core";

import { ScriptError } from "./errors";
import { ScriptRuntimeError } from "./runtime-errors";
import { ScriptSandbox, type ScriptSandboxMetadata } from "./sandbox";
import type { ScriptWorkerRequest, ScriptWorkerResponse } from "./worker-protocol";

interface Session {
  sandbox: ScriptSandbox;
  metadata: ScriptSandboxMetadata;
}

/**
 * Transport-independent implementation of the WickScript worker protocol.
 *
 * A Web Worker entry only needs to forward messages to `handle` and post back the response.
 */
export class ScriptWorkerCore {
  private readonly sessions = new Map<number, Session>();
  private nextSessionId = 1;

  async handle(request: ScriptWorkerRequest): Promise<ScriptWorkerResponse> {
    try {
      if (request.type === "compile") {
        const sandbox = await ScriptSandbox.create(request.source, request.inputs, request.options);
        const sessionId = this.nextSessionId;
        this.nextSessionId += 1;
        const metadata = sandbox.getMetadata();
        this.sessions.set(sessionId, { sandbox, metadata });
        return { type: "compiled", requestId: request.requestId, sessionId, metadata };
      }

      if (request.type === "run") {
        const session = this.sessions.get(request.sessionId);
        if (!session) {
          throw new ScriptRuntimeError("RUNTIME_ERROR", "Unknown script session");
        }
        return {
          type: "result",
          requestId: request.requestId,
          result: session.sandbox.run(request.bars as readonly OhlcData[]),
        };
      }

      const session = this.sessions.get(request.sessionId);
      session?.sandbox.dispose();
      this.sessions.delete(request.sessionId);
      return { type: "disposed", requestId: request.requestId };
    } catch (error) {
      return { type: "error", requestId: request.requestId, error: serializeError(error) };
    }
  }

  dispose(): void {
    for (const session of this.sessions.values()) {
      session.sandbox.dispose();
    }
    this.sessions.clear();
  }
}

function serializeError(error: unknown) {
  if (error instanceof ScriptRuntimeError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      barIndex: error.barIndex,
    };
  }
  if (error instanceof ScriptError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
    };
  }
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : "Unknown script error",
  };
}
