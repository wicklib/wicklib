import { describe, expect, it } from "vitest";

import { WickChart, useChart } from "../src/index";

describe("@wicklib/react", () => {
  it("exports the component", () => {
    expect(typeof WickChart).toBe("function");
  });

  it("exports the hook", () => {
    expect(typeof useChart).toBe("function");
  });
});
