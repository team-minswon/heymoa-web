import { describe, expect, it } from "vitest";

import {
  dropChatFromList,
  groupChatsByRecency,
  relativeUpdatedAt,
  retitleChatInList,
  revertChatTitle,
  titleSourceOf,
  runningLabel,
  type OpenChatStatus,
} from "@/lib/chat/chat-list";
import { normalizeChatTitle } from "@/lib/chat/rename-chat";

const NOW = new Date("2026-08-25T12:00:00Z");
const TZ = "UTC";

const row = (
  chatId: string,
  turnId: string | null,
  status = "IN_PROGRESS"
) => ({
  chatId,
  runningTurn: turnId ? { turnId, status: status as "IN_PROGRESS" } : null,
});
const open = (
  chatId: string | null,
  turnId: string | null,
  phase: OpenChatStatus["phase"],
  finishedTurnId: string | null = null
): OpenChatStatus => ({ chatId, turnId, phase, finishedTurnId });

// ★ 배지가 깜빡이는 것이 두 출처의 어긋남이다. 순서를 바꾸면 깜빡인다.
describe("배지는 두 출처를 턴 id 로 맞춘다", () => {
  it("다른 대화는 목록을 믿는다 — 이 탭은 그 스트림을 안 듣고 있다", () => {
    expect(runningLabel(row("c2", "t9"), open("c1", "t1", "streaming"))).toBe(
      "진행 중"
    );
  });

  it("같은 턴 id 면 스트림이 이긴다 — 끝난 것을 목록이 아직 모를 뿐이다", () => {
    expect(runningLabel(row("c1", "t1"), open("c1", "t1", "done"))).toBeNull();
  });

  it("목록엔 없는데 스트림이 흐르면 스트림이 이긴다", () => {
    expect(runningLabel(row("c1", null), open("c1", "t1", "streaming"))).toBe(
      "진행 중"
    );
  });

  it("다른 턴 id 면 목록이 유일한 소식이다", () => {
    expect(runningLabel(row("c1", "t2"), open("c1", "t1", "done"))).toBe(
      "진행 중"
    );
  });

  it("승인 대기는 다른 라벨이고 양쪽 출처가 같은 말을 한다", () => {
    expect(
      runningLabel(row("c1", "t1"), open("c1", "t1", "awaiting_approval"))
    ).toBe("승인 대기");
    expect(
      runningLabel(
        row("c2", "t9", "WAITING_APPROVAL"),
        open("c1", null, "idle")
      )
    ).toBe("승인 대기");
  });

  it("★ 끝나는 것을 본 턴은 목록이 아직 들고 있어도 배지를 안 세운다", () => {
    // 턴이 끝나면 `stream.reset()` 이 `turnId` 를 비운다. 그 순간 목록은 아직 한 주기(5초)
    // 동안 그 턴을 「도는 중」으로 들고 있어서, 맞출 열쇠가 없으면 위 「다른 턴 id」 규칙에
    // 걸려 **사라졌던 배지가 다시 선다** — QA 가 본 깜빡임이 이것이다.
    expect(
      runningLabel(row("c1", "t1"), open("c1", null, "idle", "t1"))
    ).toBeNull();
  });

  it("끝난 턴을 기억해도 그 뒤에 시작한 남의 턴은 가리지 않는다", () => {
    // 다른 탭이 t2 를 열었다. 우리가 t1 이 끝나는 것을 봤다는 사실과 무관하다.
    expect(runningLabel(row("c1", "t2"), open("c1", null, "idle", "t1"))).toBe(
      "진행 중"
    );
  });

  it("아무 대화도 안 열려 있으면 목록이 전부다", () => {
    expect(runningLabel(row("c1", "t1"), open(null, null, "idle"))).toBe(
      "진행 중"
    );
    expect(runningLabel(row("c1", null), open(null, null, "idle"))).toBeNull();
  });
});

describe("시간으로 묶는다", () => {
  const at = (iso: string) => ({ updatedAt: iso });

  it("없는 묶음은 안 그린다", () => {
    expect(
      groupChatsByRecency([at("2026-08-25T09:00:00Z")], NOW, TZ).map(
        (g) => g.label
      )
    ).toEqual(["오늘"]);
  });

  it("넷뿐이다 — 오늘 · 어제 · 지난 7일 · 이전", () => {
    const groups = groupChatsByRecency(
      [
        at("2026-08-25T09:00:00Z"),
        at("2026-08-24T09:00:00Z"),
        at("2026-08-21T09:00:00Z"),
        at("2026-07-01T09:00:00Z"),
      ],
      NOW,
      TZ
    );
    expect(groups.map((g) => g.label)).toEqual([
      "오늘",
      "어제",
      "지난 7일",
      "이전",
    ]);
  });

  it("「지난 7일」은 날짜 차이 2~6일, 7일째부터 「이전」이다", () => {
    const groups = groupChatsByRecency(
      [
        at("2026-08-23T09:00:00Z"),
        at("2026-08-19T09:00:00Z"),
        at("2026-08-18T09:00:00Z"),
      ],
      NOW,
      TZ
    );
    expect(groups.map((g) => [g.label, g.chats.length])).toEqual([
      ["지난 7일", 2],
      ["이전", 1],
    ]);
  });

  // 「어제 오후 11시」와 「오늘 오전 1시」는 두 시간 차이지만 다른 묶음이다
  it("경계는 시각이 아니라 날짜다", () => {
    const groups = groupChatsByRecency(
      [at("2026-08-25T01:00:00Z"), at("2026-08-24T23:00:00Z")],
      NOW,
      TZ
    );
    expect(groups.map((g) => g.label)).toEqual(["오늘", "어제"]);
  });

  it("여기서 다시 정렬하지 않는다 — 순서의 주인은 서버다", () => {
    const rows = [at("2026-08-25T01:00:00Z"), at("2026-08-25T09:00:00Z")];
    expect(groupChatsByRecency(rows, NOW, TZ)[0].chats).toEqual(rows);
  });

  it("빈 목록은 빈 묶음이다", () => {
    expect(groupChatsByRecency([], NOW, TZ)).toEqual([]);
  });
});

// 다른 값을 그리면 「1분 전인데 왜 세 번째 줄」이 된다
describe("그리는 시각이 정렬 기준과 같은 값이다", () => {
  it("1분 미만은 방금이다", () => {
    expect(relativeUpdatedAt("2026-08-25T11:59:30Z", NOW, "ko")).toBe("방금");
  });

  it("분·시간·일·달·해로 넘어간다", () => {
    expect(relativeUpdatedAt("2026-08-25T11:00:00Z", NOW, "ko")).toContain("1");
    expect(relativeUpdatedAt("2026-08-22T12:00:00Z", NOW, "ko")).toContain("3");
    expect(relativeUpdatedAt("2026-06-01T12:00:00Z", NOW, "ko")).toContain("2");
    expect(relativeUpdatedAt("2024-08-25T12:00:00Z", NOW, "ko")).toContain("2");
  });
});

describe("dropChatFromList", () => {
  const ok = (ids: string[]) => ({
    status: 200,
    data: {
      success: true,
      data: { chats: ids.map((chatId) => ({ chatId })), hasMore: false },
    },
  });

  it("그 대화 줄만 빼고 나머지 모양은 그대로 둔다", () => {
    expect(dropChatFromList(ok(["a", "b"]), "a")).toEqual(ok(["b"]));
  });

  it("실패 응답과 빈 캐시는 손대지 않는다", () => {
    const failed = { status: 404, data: { success: false } };
    expect(dropChatFromList(failed, "a")).toBe(failed);
    expect(dropChatFromList(undefined, "a")).toBeUndefined();
  });
});

describe("retitleChatInList", () => {
  it("그 줄의 제목만 바꾸고 순서는 그대로 둔다", () => {
    const list = {
      status: 200,
      data: {
        success: true,
        data: {
          chats: [
            { chatId: "A", title: "가" },
            { chatId: "B", title: "나" },
          ],
        },
      },
    };
    // 출처도 사람으로 바뀐다 — 다시 바꿀 때 계측이 「USER 를 또 고쳤다」를 안다
    expect(retitleChatInList(list, "B", "새")).toEqual({
      ...list,
      data: {
        ...list.data,
        data: {
          chats: [
            { chatId: "A", title: "가" },
            { chatId: "B", title: "새", titleSource: "USER" },
          ],
        },
      },
    });
  });

  it("실패 응답은 손대지 않는다", () => {
    const failed = { status: 500, data: { success: false, data: null } };
    expect(retitleChatInList(failed, "A", "새")).toBe(failed);
  });
});

describe("normalizeChatTitle", () => {
  it("한 줄로 접고 앞뒤 공백을 지우며, 비면 null", () => {
    expect(normalizeChatTitle("  주간\n  회의  ")).toBe("주간 회의");
    expect(normalizeChatTitle(" \t ")).toBeNull();
    expect(normalizeChatTitle("가".repeat(120))).toHaveLength(100);
  });
});

describe("titleSourceOf", () => {
  it("계약 값만 믿고, 없거나 모르는 값은 UNKNOWN 이다", () => {
    const chats = [
      { chatId: "A", titleSource: "AI" },
      { chatId: "B" },
      { chatId: "C", titleSource: "SOMETHING" },
    ];
    expect(titleSourceOf(chats, "A")).toBe("AI");
    expect(titleSourceOf(chats, "B")).toBe("UNKNOWN");
    expect(titleSourceOf(chats, "C")).toBe("UNKNOWN");
    expect(titleSourceOf(chats, "Z")).toBe("UNKNOWN");
  });
});

describe("revertChatTitle", () => {
  const rows = [
    { chatId: "a", title: "낙관", titleSource: "USER" },
    { chatId: "b", title: "낙관", titleSource: "USER" },
  ];

  it("그 대화가 아직 낙관값일 때만 그 한 줄을 되돌린다", () => {
    const reverted = revertChatTitle(rows, "a", "낙관", {
      title: "원래",
      titleSource: "AI",
    });
    expect(reverted[0]).toEqual({
      chatId: "a",
      title: "원래",
      titleSource: "AI",
    });
    expect(reverted[1]).toBe(rows[1]);
  });

  it("그 사이 다른 값이 들어왔으면 건드리지 않는다", () => {
    const changed = [{ ...rows[0], title: "다른 탭" }];
    expect(
      revertChatTitle(changed, "a", "낙관", { title: "원래" })[0].title
    ).toBe("다른 탭");
  });
});

describe("상대 시각은 앱 언어로", () => {
  it("한국어 화면은 「57분 전」·「방금」이다", () => {
    expect(relativeUpdatedAt("2026-08-25T11:03:00Z", NOW, "ko")).toBe(
      "57분 전"
    );
    expect(relativeUpdatedAt("2026-08-25T11:59:30Z", NOW, "ko")).toBe("방금");
  });

  it("영어 화면은 영어다", () => {
    expect(relativeUpdatedAt("2026-08-25T11:03:00Z", NOW, "en")).toMatch(
      /57.*ago/
    );
    expect(relativeUpdatedAt("2026-08-25T11:59:30Z", NOW, "en")).toBe(
      "just now"
    );
  });
});
