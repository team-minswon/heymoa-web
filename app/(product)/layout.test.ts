import { describe, expect, it, vi } from "vitest";

import { generateMetadata } from "@/app/(product)/layout";

const locale = vi.hoisted(() => ({ value: "ko" as "ko" | "en" }));
vi.mock("@/lib/i18n/current", () => ({
  productLocale: async () => locale.value,
}));

// 제품 면에는 색인할 페이지가 없다. 새 라우트가 noindex 를 빠뜨려도 막히는 기본값이다(APP-1295).
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
