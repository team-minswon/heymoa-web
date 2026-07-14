import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NoteRouteSurface } from "@/components/notes/note-route-surface";

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => true,
}));

describe("NoteRouteSurface", () => {
  it("uses the compact historical width for the desktop side sheet", () => {
    render(
      <NoteRouteSurface view="side" isOpen onClose={vi.fn()}>
        <p>노트 내용</p>
      </NoteRouteSurface>
    );

    const sheet = screen.getByLabelText("노트");
    expect(sheet.style.maxWidth).toBe("780px");
  });
});
