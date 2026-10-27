import type { OhlcData } from "@wicklib/core";
import { describe, expect, it } from "vitest";

import { ScriptWorkerCore } from "../src/worker-core";
import type { ScriptWorkerRequest } from "../src/worker-protocol";

const source = `// @wicklib/api 1
import { defineScript } from "@wicklib/script";
export default defineScript({
  inputs: {},
  plots: [{ id: "line", title: "Line", type: "line" }],
  onBar(ctx) { ctx.plot("line", ctx.bar.close); },
});
`;

const bars: OhlcData[] = [
  { time: 0, open: 1, high: 2, low: 0, close: 1 },
  { time: 60_000, open: 1, high: 3, low: 0, close: 2 },
];

describe("ScriptWorkerCore", () => {
  it("compiles, runs, and disposes a session", async () => {
    const core = new ScriptWorkerCore();
    try {
      const compiled = await core.handle({
        type: "compile",
        requestId: 1,
        source,
      });
      expect(compiled.type).toBe("compiled");
      if (compiled.type !== "compiled") return;
      expect(compiled.metadata.plots[0]?.id).toBe("line");

      const result = await core.handle({
        type: "run",
        requestId: 2,
        sessionId: compiled.sessionId,
        bars,
      });
      expect(result.type).toBe("result");
      if (result.type !== "result") return;
      expect(result.result.plots.line).toEqual([1, 2]);

      const disposed = await core.handle({
        type: "dispose",
        requestId: 3,
        sessionId: compiled.sessionId,
      });
      expect(disposed.type).toBe("disposed");
    } finally {
      core.dispose();
    }
  });

  it("serializes compile errors", async () => {
    const core = new ScriptWorkerCore();
    try {
      const response = await core.handle({
        type: "compile",
        requestId: 1,
        source: "export default 1;",
      } satisfies ScriptWorkerRequest);
      expect(response.type).toBe("error");
      if (response.type !== "error") return;
      expect(response.error.code).toBe("INVALID_API_VERSION");
    } finally {
      core.dispose();
    }
  });
});
