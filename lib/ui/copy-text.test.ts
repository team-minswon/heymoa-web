import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText } from "./copy-text";

function stubClipboard(writeText: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText === undefined ? undefined : { writeText },
    configurable: true,
  });
}

afterEach(() => vi.restoreAllMocks());

describe("copyText", () => {
  it("clipboard API가 되면 그것만 쓴다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    document.execCommand = vi.fn();
    await copyText("a");
    expect(writeText).toHaveBeenCalledWith("a");
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it("API가 거부하면 execCommand로 한 번 더 시도한다", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    document.execCommand = vi.fn(() => true);
    await expect(copyText("a")).resolves.toBeUndefined();
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("API가 없어도 execCommand가 되면 성공한다", async () => {
    stubClipboard(undefined);
    document.execCommand = vi.fn(() => true);
    await expect(copyText("a")).resolves.toBeUndefined();
  });

  it("둘 다 안 되면 reject한다", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    document.execCommand = vi.fn(() => false);
    await expect(copyText("a")).rejects.toThrow("NotAllowedError");
  });
});
