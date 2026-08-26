import { describe, expect, it } from "vitest";

import {
  groupChatsByRecency,
  relativeUpdatedAt,
  runningLabel,
  type OpenChatStatus,
} from "@/lib/chat/chat-list";

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

  it("셋뿐이다 — 오늘 · 최근 · 지난", () => {
    const groups = groupChatsByRecency(
      [
        at("2026-08-25T09:00:00Z"),
        at("2026-08-21T09:00:00Z"),
        at("2026-07-01T09:00:00Z"),
      ],
      NOW,
      TZ
    );
    expect(groups.map((g) => g.label)).toEqual(["오늘", "최근", "지난"]);
  });

  // 「어제 오후 11시」와 「오늘 오전 1시」는 두 시간 차이지만 다른 묶음이다
  it("경계는 시각이 아니라 날짜다", () => {
    const groups = groupChatsByRecency(
      [at("2026-08-25T01:00:00Z"), at("2026-08-24T23:00:00Z")],
      NOW,
      TZ
    );
    expect(groups.map((g) => g.label)).toEqual(["오늘", "최근"]);
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
