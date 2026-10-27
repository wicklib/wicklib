import type { OhlcData } from "@wicklib/core";
import { describe, expect, it } from "vitest";

import { ScriptError } from "../src/errors";
import { createScriptWorkerRuntime } from "../src/runtime";
import type { ScriptWorkerPort } from "../src/runtime";
import { ScriptWorkerCore } from "../src/worker-core";
import type { ScriptWorkerRequest, ScriptWorkerResponse } from "../src/worker-protocol";

const source = `// @wicklib/api 1
import { defineScript } from "@wicklib/script";
export default defineScript({
  inputs: {},
  plots: [{ id: "line", title: "Line", type: "line" }],
  onBar(ctx) {
    const count = (ctx.state.get("count") ?? 0) + 1;
    ctx.state.set("count", count);
    ctx.plot("line", count);
  },
});
`;

const bars: OhlcData[] = [1, 2, 3].map((close, index) => ({
  time: index * 60_000,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
}));

class FakeWorker implements ScriptWorkerPort {
  private readonly core = new ScriptWorkerCore();
  private readonly listeners = new Set<(event: MessageEvent<ScriptWorkerResponse>) => void>();

  postMessage(message: ScriptWorkerRequest): void {
    void this.core.handle(message).then((response) => {
      const event = { data: response } as MessageEvent<ScriptWorkerResponse>;
      for (const listener of this.listeners) {
        listener(event);
      }
    });
  }

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<ScriptWorkerResponse>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<ScriptWorkerResponse>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  terminate(): void {
    this.core.dispose();
  }
}

describe("worker runtime client", () => {
  it("compiles, replays, and streams through the worker port", async () => {
    const port = new FakeWorker();
    const runtime = createScriptWorkerRuntime(port);
    try {
      const script = await runtime.compile(source);
      expect(script.metadata.plots[0]?.id).toBe("line");
      expect((await script.replay(bars)).plots.line).toEqual([1, 2, 3]);
      await script.dispose();
    } finally {
      runtime.dispose();
    }
  });

  it("keeps replay and streaming on the same state path", async () => {
    const runtime = createScriptWorkerRuntime(new FakeWorker());
    try {
      const full = await runtime.compile(source);
      const mixed = await runtime.compile(source);

      const replay = await full.replay(bars);
      const prefix = await mixed.replay(bars.slice(0, 2));
      const streamed = await mixed.stream(bars[2]!);

      expect(prefix.plots.line).toEqual([1, 2]);
      expect(streamed.plots.line).toEqual([3]);
      expect([...(prefix.plots.line ?? []), ...(streamed.plots.line ?? [])]).toEqual(
        replay.plots.line,
      );

      await full.dispose();
      await mixed.dispose();
    } finally {
      runtime.dispose();
    }
  });

  it("reconstructs compile failures", async () => {
    const runtime = createScriptWorkerRuntime(new FakeWorker());
    try {
      await expect(runtime.compile("export default 1;")).rejects.toBeInstanceOf(ScriptError);
    } finally {
      runtime.dispose();
    }
  });
});
