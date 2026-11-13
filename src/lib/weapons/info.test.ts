import { describe, expect, it } from "vitest";
import { buildsFrom, lineTo } from "./info";

describe("lineTo", () => {
  it("runs from the root of the line to the weapon", () => {
    const line = lineTo("smash-wrench").map((w) => w.id);
    expect(line.at(-1)).toBe("smash-wrench");
    expect(line[0]).toBe("battle-wrench");
    expect(buildsFrom(line[0])).toHaveLength(0);
  });

  it("is just the weapon for a root weapon", () => {
    expect(lineTo("battle-wrench").map((w) => w.id)).toEqual(["battle-wrench"]);
  });
});
