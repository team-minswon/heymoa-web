import { describe, expect, it, vi } from "vitest";

import { generateMetadata } from "@/app/(product)/layout";

const locale = vi.hoisted(() => ({ value: "ko" as "ko" | "en" }));
vi.mock("@/lib/i18n/current", () => ({
  productLocale: async () => locale.value,
}));

describe("제품 루트 레이아웃 metadata", () => {
  it("기본이 noindex 이고 홈 canonical·hreflang 을 물려주지 않는다", async () => {
    const metadata = await generateMetadata();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeNull();
  });

  it("탭 제목은 화면 언어를 따른다", async () => {
    locale.value = "en";
    expect((await generateMetadata()).title).toMatchObject({
      default: "HeyMoa | Real-time AI meeting notes",
    });
  });
});
