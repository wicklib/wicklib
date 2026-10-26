import { describe, expect, it } from "vitest";

import {
  SCRIPT_NOT_IMPLEMENTED,
  WICKSCRIPT_API_VERSION,
  registerScriptFunction,
} from "../src/index";

describe("@wicklib/script", () => {
  it("exposes an API version", () => {
    expect(WICKSCRIPT_API_VERSION).toBeGreaterThan(0);
  });

  it("registerScriptFunction is a typed stub", () => {
    expect(() =>
      registerScriptFunction("ta.sma", () => 0, { name: "ta.sma", license: "free" }),
    ).toThrow(SCRIPT_NOT_IMPLEMENTED);
  });
});
