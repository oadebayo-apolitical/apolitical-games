import { describe, it, expect } from "vitest";
import { inMemoryServedPeople, noopServedPeople } from "./served-people";

describe("inMemoryServedPeople", () => {
  it("tracks served qids", async () => {
    const repo = inMemoryServedPeople();
    expect((await repo.servedQids()).size).toBe(0);
    await repo.remember({ qid: "Q1", name: "One", title: "One" });
    await repo.remember({ qid: "Q2", name: "Two", title: "Two" });
    const qids = await repo.servedQids();
    expect(qids.has("Q1")).toBe(true);
    expect(qids.has("Q2")).toBe(true);
    expect(qids.size).toBe(2);
  });

  it("oldestServedQid returns least-recently-served, excluding given qids", async () => {
    const repo = inMemoryServedPeople();
    await repo.remember({ qid: "Q1", name: "One", title: "One" });
    await repo.remember({ qid: "Q2", name: "Two", title: "Two" });
    await repo.remember({ qid: "Q3", name: "Three", title: "Three" });
    // Q1 is oldest; excluding it yields Q2.
    expect(await repo.oldestServedQid([])).toBe("Q1");
    expect(await repo.oldestServedQid(["Q1"])).toBe("Q2");
    expect(await repo.oldestServedQid(["Q1", "Q2", "Q3"])).toBe(null);
  });

  it("re-remembering refreshes recency", async () => {
    const repo = inMemoryServedPeople();
    await repo.remember({ qid: "Q1", name: "One", title: "One" });
    await repo.remember({ qid: "Q2", name: "Two", title: "Two" });
    await repo.remember({ qid: "Q1", name: "One", title: "One" }); // Q1 now newest
    expect(await repo.oldestServedQid([])).toBe("Q2");
  });
});

describe("noopServedPeople", () => {
  it("records nothing", async () => {
    const repo = noopServedPeople();
    await repo.remember({ qid: "Q1", name: "One", title: "One" });
    expect((await repo.servedQids()).size).toBe(0);
    expect(await repo.oldestServedQid([])).toBe(null);
  });
});
