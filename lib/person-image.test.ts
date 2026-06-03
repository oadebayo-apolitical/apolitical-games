import { describe, it, expect } from "vitest";
import { widenThumb } from "./person-image";

describe("widenThumb", () => {
  it("rewrites a thumbnail width segment", () => {
    const url =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Foo.jpg/330px-Foo.jpg";
    expect(widenThumb(url, 640)).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Foo.jpg/640px-Foo.jpg"
    );
  });

  it("defaults to 640px", () => {
    const url =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Foo.jpg/200px-Foo.jpg";
    expect(widenThumb(url)).toContain("/640px-Foo.jpg");
  });

  it("leaves a non-thumbnail URL unchanged", () => {
    const url =
      "https://commons.wikimedia.org/wiki/Special:FilePath/Foo.jpg?width=640";
    expect(widenThumb(url)).toBe(url);
  });
});
