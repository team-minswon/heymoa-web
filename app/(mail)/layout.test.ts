import { describe, expect, it } from "vitest";

import { metadata } from "@/app/(mail)/layout";

// 토큰이 주소에 실리는 면이다(APP-1314). 색인하지 않고, 페이지 안에서 나가는 요청에도 Referer 를 싣지 않는다.
describe("메일 링크 루트 레이아웃 metadata", () => {
  it("noindex 이고 referrer 를 보내지 않는다", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.alternates).toBeNull();
    expect(metadata.referrer).toBe("no-referrer");
  });
});
