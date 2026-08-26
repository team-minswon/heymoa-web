"use client";

import { useEffect, useState } from "react";

import { usePersonalChat } from "@/components/chat/personal-chat";

/**
 * 노트 전체 화면의 오른쪽 레일. design.pen `L4PpR` — 통째로 개인 챗봇이다.
 *
 * **탭이 없다.** 예전에는 「이 회의 / 내 에이전트」 둘이었는데 공유 챗봇이 사라지면서 하나만
 * 남았고, 탭이 하나면 레일이 곧 그 대화다.
 *
 * 여기서 새로 그리지 않는다 — 셸이 이미 들고 있는 개인 챗봇 패널을 이 자리로 **포털**해 온다.
 * 새로 그리면 같은 대화의 세션이 두 벌이 된다.
 */
export function NoteAgentRail({ foldedOnNarrow }: { foldedOnNarrow: boolean }) {
  const { setRailSlot } = usePersonalChat();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setRailSlot(slot);
    return () => setRailSlot(null);
  }, [setRailSlot, slot]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      {/*
        셸의 개인 챗봇 패널이 이 안으로 들어온다. 비어 있는 동안에도 자리는 남긴다.
        접혀 있어도 **언마운트하지 않는다** — 흐르던 스트림이 끊기면 계약상 부분 응답은
        저장되지 않아 답변이 통째로 사라진다.
      */}
      <div
        ref={setSlot}
        aria-label="내 에이전트"
        className={foldedOnNarrow ? "flex min-h-0 flex-1 max-lg:hidden" : "flex min-h-0 flex-1"}
      />
    </div>
  );
}
