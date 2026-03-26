import { describe, it, expect } from "vitest";
import { getCreditChange } from "../credit";

describe("getCreditChange", () => {
  it("returns +2 for attend", () => {
    expect(getCreditChange("attend")).toBe(2);
  });

  it("returns -20 for no_show", () => {
    expect(getCreditChange("no_show")).toBe(-20);
  });

  it("returns -10 for reported", () => {
    expect(getCreditChange("reported")).toBe(-10);
  });
});
