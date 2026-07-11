import { describe, expect, it } from "vitest";
import { normalizeNoteViewQuery } from "@/components/notes/note-view";
import { resolveNoteSurface } from "@/components/notes/note-route-surface";

describe("normalizeNoteViewQuery", () => {
  it("falls back to full transcript", () => {
    expect(normalizeNoteViewQuery({ view: "invalid", tab: "invalid" })).toEqual(
      {
        view: "full",
        tab: "transcript",
      }
    );
  });

  it("preserves an explicit side details view", () => {
    expect(normalizeNoteViewQuery({ view: "side", tab: "details" })).toEqual({
      view: "side",
      tab: "details",
    });
  });
});

describe("resolveNoteSurface", () => {
  it("uses a desktop Sheet for side view", () => {
    expect(resolveNoteSurface("side", true)).toBe("sheet");
  });

  it("uses a mobile Drawer for the same side URL", () => {
    expect(resolveNoteSurface("side", false)).toBe("drawer");
  });

  it("keeps full view independent of viewport", () => {
    expect(resolveNoteSurface("full", true)).toBe("full");
    expect(resolveNoteSurface("full", false)).toBe("full");
  });
});
