import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "@/hooks/use-media-query";

describe("useMediaQuery", () => {
  it("subscribes to matchMedia changes", () => {
    let matches = false;
    let listener: (() => void) | undefined;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_type: string, next: () => void) => {
        listener = next;
      },
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      listener?.();
    });
    expect(result.current).toBe(true);
  });
});
