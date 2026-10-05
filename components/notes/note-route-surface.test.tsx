import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { NoteRouteSurface } from "@/components/notes/note-route-surface";

describe("NoteRouteSurface", () => {
  afterEach(cleanup);
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

  it("renders the full surface in the shared portal", () => {
    render(
      <NoteRouteSurface view="full" isOpen onClose={vi.fn()}>
        <p>노트 내용</p>
      </NoteRouteSurface>
    );

    const surface = document.querySelector('[data-surface="full"]');
    expect(surface).toBeInTheDocument();
    expect(surface).toHaveTextContent("노트 내용");
  });
  it("keeps edited content, scroll and stale query subscription across both modes", async () => {
    const read = vi.fn().mockResolvedValue("전사 내용");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    function Body() {
      const [value, setValue] = useState("");
      const query = useQuery({ queryKey: ["transcript"], queryFn: read });
      return (
        <div data-testid="reader">
          <textarea
            aria-label="메모"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {query.data}
        </div>
      );
    }
    function View({ view }: { view: "side" | "full" }) {
      return (
        <QueryClientProvider client={queryClient}>
          <NoteRouteSurface view={view} isOpen onClose={vi.fn()}>
            <Body />
          </NoteRouteSurface>
        </QueryClientProvider>
      );
    }
    const { rerender } = render(<View view="side" />);
    await screen.findByText("전사 내용");
    const input = screen.getByLabelText("메모");
    const reader = screen.getByTestId("reader");
    reader.scrollTop = 120;
    fireEvent.change(input, { target: { value: "읽던 기록" } });
    rerender(<View view="full" />);
    expect(screen.getByLabelText("메모")).toBe(input);
    expect(input).toHaveValue("읽던 기록");
    expect(reader.scrollTop).toBe(120);
    rerender(<View view="side" />);
    expect(screen.getByLabelText("메모")).toBe(input);
    expect(input).toHaveValue("읽던 기록");
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  });

  it("keeps the full direct-link skeleton before the portal opens", () => {
    render(
      <NoteRouteSurface view="full" isOpen={false} onClose={vi.fn()}>
        <p>본문</p>
      </NoteRouteSurface>
    );
    expect(screen.getByLabelText("노트 불러오는 중")).toBeVisible();
    expect(screen.queryByText("본문")).not.toBeInTheDocument();
  });
  it("does not show the initial skeleton again when an opened full note closes", () => {
    const { rerender } = render(
      <NoteRouteSurface view="full" isOpen={false} onClose={vi.fn()}>
        <p>본문</p>
      </NoteRouteSurface>
    );
    expect(screen.getByLabelText("노트 불러오는 중")).toBeVisible();
    rerender(
      <NoteRouteSurface view="full" isOpen onClose={vi.fn()}>
        <p>본문</p>
      </NoteRouteSurface>
    );
    rerender(
      <NoteRouteSurface view="full" isOpen={false} onClose={vi.fn()}>
        <p>본문</p>
      </NoteRouteSurface>
    );
    expect(screen.queryByLabelText("노트 불러오는 중")).not.toBeInTheDocument();
  });

  it("renders a nested sheet backdrop over the nonmodal full surface", () => {
    render(
      <NoteRouteSurface view="full" isOpen onClose={vi.fn()}>
        <Sheet open>
          <SheetContent><SheetTitle>화자</SheetTitle></SheetContent>
        </Sheet>
      </NoteRouteSurface>
    );
    expect(screen.getByRole("dialog", { name: "화자" })).toBeInTheDocument();
    const overlays = document.querySelectorAll('[data-slot="sheet-overlay"]');
    expect(overlays).toHaveLength(2);
    expect(overlays[1]).not.toHaveClass("hidden");
  });

  it("renders the nested confirmation backdrop under a nonmodal full surface", () => {
    render(
      <NoteRouteSurface view="full" isOpen onClose={vi.fn()}>
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogTitle>회의를 종료할까요?</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      </NoteRouteSurface>
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="alert-dialog-overlay"]')
    ).toBeInTheDocument();
  });
});
