import { describe, it, expect } from "vitest";
import { groupSignature } from "./puzzle";

describe("groupSignature", () => {
  it("is independent of member order", () => {
    const a = groupSignature({ members: ["ROBIN", "SWIFT", "SWALLOW", "WREN"] });
    const b = groupSignature({ members: ["WREN", "ROBIN", "SWALLOW", "SWIFT"] });
    expect(a).toBe(b);
  });

  it("is case- and whitespace-insensitive", () => {
    const a = groupSignature({ members: ["Robin", " swift ", "Swallow", "wren"] });
    const b = groupSignature({ members: ["ROBIN", "SWIFT", "SWALLOW", "WREN"] });
    expect(a).toBe(b);
  });

  it("differs when any member differs", () => {
    expect(groupSignature({ members: ["A", "B", "C", "D"] })).not.toBe(
      groupSignature({ members: ["A", "B", "C", "E"] })
    );
  });
});
