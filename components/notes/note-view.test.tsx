import { describe, expect, it } from "vitest";
import { normalizeNoteViewQuery } from "@/components/notes/note-view";

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
