import { describe, it, expect } from "vitest";
import { inMemoryServedGroups, noopServedGroups } from "./served-groups";

describe("inMemoryServedGroups", () => {
  it("remembers signatures and reports which are seen", async () => {
    const repo = inMemoryServedGroups();
    expect((await repo.seen(["a", "b"])).size).toBe(0);
    await repo.remember([{ sig: "a", name: "Alpha", members: ["A"] }]);
    const seen = await repo.seen(["a", "b"]);
    expect(seen.has("a")).toBe(true);
    expect(seen.has("b")).toBe(false);
  });

  it("recentNames returns most-recent first", async () => {
    const repo = inMemoryServedGroups();
    await repo.remember([{ sig: "1", name: "One", members: [] }]);
    await repo.remember([{ sig: "2", name: "Two", members: [] }]);
    expect(await repo.recentNames(10)).toEqual(["Two", "One"]);
  });

  it("ignores a repeated signature on remember", async () => {
    const repo = inMemoryServedGroups();
    await repo.remember([{ sig: "x", name: "X", members: [] }]);
    await repo.remember([{ sig: "x", name: "X again", members: [] }]);
    expect(await repo.recentNames(10)).toEqual(["X"]);
  });
});

describe("noopServedGroups", () => {
  it("never records anything", async () => {
    const repo = noopServedGroups();
    await repo.remember([{ sig: "a", name: "A", members: [] }]);
    expect((await repo.seen(["a"])).size).toBe(0);
    expect(await repo.recentNames(10)).toEqual([]);
  });
});
