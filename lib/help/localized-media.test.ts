import { describe, expect, it, vi } from "vitest";

import { HELP_MEDIA } from "@/lib/help/media-manifest";

vi.mock("@/lib/help/media-manifest-en", () => ({
  HELP_MEDIA_EN: { "tasks/table.webp": { width: 1200, height: 700, bytes: 1 } },
}));

const { localizedHelpMedia } = await import("@/lib/help/localized-media");

describe("localizedHelpMedia (APP-1511)", () => {
  it("영어 페이지는 영어로 찍은 파일과 그 크기를 쓴다", () => {
    expect(localizedHelpMedia("tasks/table.webp", "en")).toEqual({
      path: "en/tasks/table.webp",
      width: 1200,
      height: 700,
    });
  });

  it("영어 파일이 없는 항목은 한국어 파일로 대체한다", () => {
    const { width, height } = HELP_MEDIA["recording/dock.webp"];
    expect(localizedHelpMedia("recording/dock.webp", "en")).toEqual({ path: "recording/dock.webp", width, height });
  });

  it("한국어 페이지는 영어 파일이 있어도 한국어 파일이다", () => {
    const { width, height } = HELP_MEDIA["tasks/table.webp"];
    expect(localizedHelpMedia("tasks/table.webp", "ko")).toEqual({ path: "tasks/table.webp", width, height });
  });
});
