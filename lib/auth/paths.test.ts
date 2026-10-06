import { describe, expect, it } from "vitest";

import { normalizeReturnTo } from "@/lib/auth/paths";

describe("normalizeReturnTo", () => {
  it("초대 랜딩은 토큰 쿼리를 보존한 채 돌아올 수 있다", () => {
    expect(normalizeReturnTo("/invite?token=abc")).toBe("/invite?token=abc");
  });

  it("외부 에이전트가 준 새 회의·발화 주소는 쿼리를 보존한 채 돌아온다", () => {
    expect(
      normalizeReturnTo("/w/01K0000000000/notes/new?projectId=01K0000000001")
    ).toBe("/w/01K0000000000/notes/new?projectId=01K0000000001");
    expect(normalizeReturnTo("/w/01K0000000000?newMeeting=01K0000000001")).toBe(
      "/w/01K0000000000?newMeeting=01K0000000001"
    );
    expect(
      normalizeReturnTo(
        "/w/01K0000000000/notes/01K0000000020?tab=transcript&segment=01K0000000099"
      )
    ).toBe(
      "/w/01K0000000000/notes/01K0000000020?tab=transcript&segment=01K0000000099"
    );
  });

  it("노트 자리에 new 가 아닌 아무 글자나 오면 홈으로 떨어진다", () => {
    expect(normalizeReturnTo("/w/01K0000000000/notes/newer")).toBe("/");
  });

  it("외부 에이전트 인가 요청과 동의 화면은 쿼리째 돌아온다", () => {
    const authorize =
      "/oauth/authorize?response_type=code&client_id=abc&redirect_uri=http%3A%2F%2F127.0.0.1%3A1455%2Fcallback&state=s1";
    expect(normalizeReturnTo(authorize)).toBe(authorize);
    expect(normalizeReturnTo("/oauth/consent?client_id=abc&state=s1")).toBe(
      "/oauth/consent?client_id=abc&state=s1"
    );
  });

  it("/oauth 아래라도 인가 입구와 동의 화면이 아니면 홈으로 떨어진다", () => {
    expect(normalizeReturnTo("/oauth/other?x=1")).toBe("/");
  });

  it("허용 목록 밖 경로는 홈으로 떨어진다", () => {
    expect(normalizeReturnTo("/evil")).toBe("/");
  });

  it("절대 URL은 홈으로 떨어진다", () => {
    expect(normalizeReturnTo("https://evil.example/invite")).toBe("/");
  });
});
