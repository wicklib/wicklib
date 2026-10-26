import { describe, expect, it } from "vitest";

import * as wicklib from "../src/index";

describe("wicklib", () => {
  it("re-exports the core API", () => {
    expect(typeof wicklib.createChart).toBe("function");
    expect(typeof wicklib.VERSION).toBe("string");
  });
});
