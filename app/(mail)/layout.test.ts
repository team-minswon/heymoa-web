import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/current", () => ({ productLocale: async () => "en" }));

import { generateMetadata } from "@/app/(mail)/layout";

describe("메일 링크 루트 레이아웃 metadata", () => {
  it("noindex 이고 referrer 를 보내지 않는다", async () => {
    const metadata = await generateMetadata();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeNull();
    expect(metadata.referrer).toBe("no-referrer");
  });
});
