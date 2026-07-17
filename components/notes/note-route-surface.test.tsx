import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NoteRouteSurface } from "@/components/notes/note-route-surface";

describe("NoteRouteSurface", () => {
  it("uses one hydration-safe sheet that adapts from mobile to desktop", () => {
    render(
      <NoteRouteSurface view="side" isOpen onClose={vi.fn()}>
        <p>노트 내용</p>
      </NoteRouteSurface>
    );

    const sheet = screen.getByLabelText("노트");
    expect(sheet).toHaveAttribute("data-surface", "sheet");
    expect(sheet).toHaveClass("w-full", "sm:max-w-none", "md:max-w-[860px]");
    expect(sheet).not.toHaveClass("w-3/4", "sm:max-w-sm");
  });

  it("renders a stable inline surface in full view", () => {
    render(
      <NoteRouteSurface view="full" isOpen onClose={vi.fn()}>
        <p>노트 내용</p>
      </NoteRouteSurface>
    );

    const surface = document.querySelector('[data-surface="full"]');
    expect(surface).toBeInTheDocument();
    expect(surface).toHaveTextContent("노트 내용");
  });
});
