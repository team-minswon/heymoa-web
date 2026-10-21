import { describe, expect, it } from "vitest";

import { metadata } from "@/app/(product)/layout";

// 제품 면에는 색인할 페이지가 없다. 새 라우트가 noindex 를 빠뜨려도 막히는 기본값이다(APP-1295).
describe("제품 루트 레이아웃 metadata", () => {
  it("기본이 noindex 이고 홈 canonical·hreflang 을 물려주지 않는다", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeNull();
  });
});
