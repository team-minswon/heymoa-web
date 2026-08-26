import { describe, expect, it } from "vitest";

import {
  dropScopeMarkers,
  scopeMarker,
  splitScopeMarkers,
  unwrapScopeMarkers,
} from "@/lib/chat/scope-marker";

const allow = (...keys: string[]) => new Set(keys);

describe("마커를 만든다", () => {
  it("키가 요청 필드의 단수와 글자 그대로 같다", () => {
    expect(scopeMarker({ kind: "note", id: "0HZX", title: "주간 회의" })).toBe(
      "@[주간 회의](noteId:0HZX)"
    );
    expect(scopeMarker({ kind: "project", id: "0HZY", title: "알림" })).toBe(
      "@[알림](projectId:0HZY)"
    );
  });

  // 제목은 […] 안에만 들고 (…) 안은 키:id 뿐이라 )는 괄호를 못 닫는다
  it("라벨의 ] 와 \\ 만 뺀다 — 괄호는 안 뺀다", () => {
    expect(
      scopeMarker({ kind: "project", id: "A", title: "알림 정책 논의 (2차)" })
    ).toBe("@[알림 정책 논의 (2차)](projectId:A)");
    expect(scopeMarker({ kind: "note", id: "A", title: "a]b\\c" })).toBe(
      "@[a\\]b\\\\c](noteId:A)"
    );
  });

  it("만든 마커를 다시 읽으면 원래 제목이 나온다", () => {
    const raw = scopeMarker({ kind: "note", id: "A", title: "a]b\\c (2차)" });
    const [part] = splitScopeMarkers(raw, allow("note:A"));
    expect(part).toMatchObject({ title: "a]b\\c (2차)" });
  });
});

describe("문장을 쪼갠다", () => {
  it("글자와 칩이 순서대로 나온다", () => {
    expect(
      splitScopeMarkers("@[주간 회의](noteId:A) 액션 정리해줘", allow("note:A"))
    ).toEqual([
      {
        kind: "note",
        id: "A",
        title: "주간 회의",
        raw: "@[주간 회의](noteId:A)",
      },
      { text: " 액션 정리해줘" },
    ]);
  });

  it("id 길이를 안 잰다 — 목과 검사가 짧은 id 를 쓴다", () => {
    expect(
      splitScopeMarkers("@[짧다](noteId:n1) 봐", allow("note:n1"))[0]
    ).toMatchObject({
      id: "n1",
    });
  });

  // ★ 없는 것을 있는 것처럼 그리는 쪽이 나쁘다
  it("배열에 없는 id 를 가리키는 마커는 글자 그대로 남는다", () => {
    expect(
      splitScopeMarkers("@[없는 것](noteId:zzz) 봐", allow("note:aaa"))
    ).toEqual([]);
  });

  it("종류가 다르면 같은 id 여도 안 맞춘다", () => {
    expect(splitScopeMarkers("@[가](projectId:A)", allow("note:A"))).toEqual(
      []
    );
  });

  it("맞는 것과 안 맞는 것이 섞이면 맞는 것만 칩이다", () => {
    const parts = splitScopeMarkers(
      "@[가](noteId:A) 와 @[나](noteId:B)",
      allow("note:A")
    );
    expect(parts).toEqual([
      { kind: "note", id: "A", title: "가", raw: "@[가](noteId:A)" },
      { text: " 와 @[나](noteId:B)" },
    ]);
  });

  // 이미 쌓인 대화에는 마커가 없다
  it("마커가 없는 옛 메시지는 빈 배열이다 — 부르는 쪽이 갈라 간다", () => {
    expect(splitScopeMarkers("그냥 문장", allow("note:A"))).toEqual([]);
  });

  it("허용 집합을 안 주면 아무것도 안 그린다", () => {
    expect(splitScopeMarkers("@[가](noteId:A)", new Set())).toEqual([]);
  });
});

describe("마커를 되돌린다", () => {
  it("라벨만 남긴다", () => {
    expect(unwrapScopeMarkers("@[주간 회의](noteId:A) 정리")).toBe(
      "주간 회의 정리"
    );
  });

  it("이스케이프를 푼다", () => {
    expect(unwrapScopeMarkers("@[a\\]b](noteId:A)")).toBe("a]b");
  });

  // ★ 안 풀면 새 배열에 없는 id 를 가리키는 마커가 그대로 나간다
  it("keep 에 든 것만 마커로 남긴다", () => {
    expect(
      unwrapScopeMarkers("@[가](noteId:A) @[나](noteId:B)", allow("A"))
    ).toBe("@[가](noteId:A) 나");
  });

  it("마커가 없으면 그대로다", () => {
    expect(unwrapScopeMarkers("그냥 문장")).toBe("그냥 문장");
  });
});

describe("칩으로 되돌릴 마커는 글자까지 지운다", () => {
  it("★ 풀지 않고 지운다 — 칩이 제목을 다시 그리므로 두 벌이 된다", () => {
    // 못 보낸 문장을 컴포저로 되돌릴 때 쓴다. 칩도 같이 다시 박으므로 마커를 제목으로
    // 풀어 두면 「@[주간 회의](…) 주간 회의 정리해줘」로 나간다.
    expect(
      dropScopeMarkers("@[주간 회의](noteId:n1) 정리해줘", new Set(["n1"]))
    ).toBe("정리해줘");
  });

  it("칩이 안 될 마커는 사람 말로 남긴다", () => {
    expect(
      dropScopeMarkers("@[주간 회의](noteId:n1) 정리해줘", new Set(["other"]))
    ).toBe("주간 회의 정리해줘");
  });

  it("지운 자리의 겹공백을 접는다", () => {
    expect(
      dropScopeMarkers(
        "@[A](noteId:n1) @[B](noteId:n2) 정리",
        new Set(["n1", "n2"])
      )
    ).toBe("정리");
  });
});
