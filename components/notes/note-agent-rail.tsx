"use client";

import { useEffect, useState } from "react";
import { PanelRightClose, Sparkles } from "lucide-react";

import { usePersonalChat } from "@/components/chat/personal-chat";
import { Button } from "@/components/ui/button";

/**
 * 노트 전체 화면의 오른쪽 레일 — **내 에이전트 하나만 산다.** 실시간 정리는 본문 「타임라인」
 * 탭으로 옮겼다(APP-863). 그래서 레일에 탭이 없고, 머리 한 줄과 대화뿐이다.
 *
 * 「내 에이전트」는 여기서 새로 그리지 않는다 — 셸이 이미 들고 있는 개인 챗봇 패널을 이 자리로
 * **포털**해 온다. 새로 그리면 같은 스코프의 세션이 두 벌이 된다. 레일이 서 있는 동안에는
 * 늘 자리를 넘긴다 — 레일이 곧 대화이므로, 레일을 연 것이 대화를 연 것이다.
 *
 * **접으면 레일이 통째로 빠진다.** 남는 줄도 없다 — 다시 여는 손잡이는 노트 위 막대와 화면
 * 아래에 있다(`NotePanel`).
 */
export function NoteAgentRail({
  onCollapse,
  collapseDisabled,
}: {
  onCollapse: () => void;
  /**
   * 답이 흐르는 중이다. 접으면 자리를 놓아 패널이 떠 있는 카드로 돌아가려 하는데, 노트 안에서는
   * 그 카드도 FAB 도 감춰져 있어 **중지·도구 승인에 닿을 길이 끊긴다.**
   */
  collapseDisabled: boolean;
}) {
  const { setRailSlot } = usePersonalChat();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setRailSlot(slot);
    return () => setRailSlot(null);
  }, [setRailSlot, slot]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--el-hairline)] pr-2 pl-4 lg:h-12">
        <Sparkles aria-hidden className="size-[15px] shrink-0 text-[var(--el-ink)]" />
        <h2 className="shrink-0 text-[13px] font-semibold text-[var(--el-ink)]">
          내 에이전트
        </h2>
        {/* 누가 이 대화를 보는지를 말한다 — 남의 눈에 안 보인다는 사실은 화면 어디에도 다시
            안 나온다. */}
        <span className="min-w-0 truncate text-[12px] text-[var(--el-muted-soft)]">
          나만 보는 대화 · 현재 회의 범위
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-control text-[var(--el-muted)]"
          aria-label={
            collapseDisabled
              ? "답변이 끝나면 접을 수 있습니다"
              : "내 에이전트 접기"
          }
          aria-expanded
          disabled={collapseDisabled}
          onClick={onCollapse}
        >
          <PanelRightClose />
        </Button>
      </div>
      {/* 셸의 개인 챗봇 패널이 이 안으로 들어온다. */}
      <div ref={setSlot} className="flex min-h-0 flex-1" />
    </div>
  );
}
