"use client";

import { useEffect, useState } from "react";
import { Lock, Users } from "lucide-react";

import { usePersonalChat } from "@/components/chat/personal-chat";
import { ContextRail } from "@/components/notes/context-rail";
import { SharedChatPanel } from "@/components/notes/shared-chat-panel";
import type { SharedChatPhase } from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

export type RailTab = "context" | "shared" | "personal";

/**
 * 노트 전체 화면의 오른쪽 레일. design.pen `L4PpR` — 위에 「이 회의 / 내 에이전트」 탭,
 * 그 아래 범위 한 줄, 나머지는 고른 탭의 대화다.
 *
 * **탭이 필요한 이유는 회의가 끝나기 때문이다.** 공유 챗봇은 살아 있는 회의에 붙은 것이라
 * 종료되면 컴포저가 잠긴다. 노트 안에서는 개인 챗봇도 감춰 놓았기 때문에, 종료된 회의를 열면
 * 물어볼 곳이 한 군데도 없었다.
 *
 * **둘 다 마운트한 채로 감춘다.** 탭을 옮길 때 언마운트하면 흐르던 답변이 끊기고, 계약상 부분
 * 응답은 저장되지 않아 통째로 사라진다.
 *
 * 「내 에이전트」는 여기서 새로 그리지 않는다 — 셸이 이미 들고 있는 개인 챗봇 패널을 이 자리로
 * **포털**해 온다. 새로 그리면 같은 스코프의 세션이 두 벌이 된다.
 */
export function NoteAgentRail({
  noteId,
  phase,
  tab,
  onTabChange,
  foldedOnNarrow,
  onSharedTurnActiveChange,
  onEvidenceSelect,
}: {
  noteId: string;
  phase: SharedChatPhase;
  /** 좁은 화면에서 레일을 접을지가 이 값에 걸려 있어서 소유자는 `NotePanel`이다. */
  tab: RailTab;
  onTabChange: (tab: RailTab) => void;
  /**
   * 좁은 화면에서 대화를 접었는가. **탭 줄은 접지 않는다** — 레일을 통째로 감추면 「내
   * 에이전트」를 고를 버튼까지 같이 감춰져서 종료된 회의에는 들어갈 길이 없어진다.
   */
  foldedOnNarrow: boolean;
  onSharedTurnActiveChange: (active: boolean) => void;
  /** 근거를 누르면 전사로 옮겨 그 발화를 짚는다. 소유자는 `NotePanel`이다. */
  onEvidenceSelect: (segmentId: string) => void;
}) {
  const { setRailSlot } = usePersonalChat();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  // **고른 동안에만** 자리를 넘긴다. 늘 넘기면 노트를 전체 화면으로 열기만 해도 개인 챗봇이
  // 마운트되어 조회가 걸린다 — 「열기 전에는 조회하지 않는다」는 규칙이 깨진다.
  useEffect(() => {
    setRailSlot(tab === "personal" ? slot : null);
    return () => setRailSlot(null);
  }, [setRailSlot, slot, tab]);

  const sharedLocked = phase === "ended" || phase === "not-started";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div
        role="tablist"
        aria-label="에이전트"
        aria-orientation="horizontal"
        // 좁은 화면의 레일 레인은 14rem이라 크롬이 그만큼 대화를 깎는다 — lg 아래에서는 조인다.
        className="flex shrink-0 items-center gap-1 border-b border-[var(--el-hairline)] px-2 py-1.5 lg:p-3"
      >
        <RailTabButton
          active={tab === "context"}
          onSelect={() => onTabChange("context")}
          label="실시간 정리"
        />
        <RailTabButton
          active={tab === "shared"}
          onSelect={() => onTabChange("shared")}
          icon={
            sharedLocked ? (
              <Lock aria-hidden className="size-3.5" />
            ) : (
              <Users aria-hidden className="size-3.5" />
            )
          }
          label="이 회의"
        />
        <RailTabButton
          active={tab === "personal"}
          onSelect={() => onTabChange("personal")}
          label="내 에이전트"
        />
      </div>

      {/* 범위 한 줄 — 누가 이 대화를 보는지가 두 탭을 가르는 전부다. */}
      <p
        className={cn(
          "shrink-0 px-3 py-1 text-[11px] font-medium text-[var(--el-body)] lg:py-2",
          foldedOnNarrow && "max-lg:hidden"
        )}
      >
        {tab === "context"
          ? "끝난 발화에서 남길 변화만 쌓입니다"
          : tab === "shared"
            ? "참여자 전원이 함께 봅니다"
            : "나만 보는 대화 · 워크스페이스 범위"}
      </p>

      <div
        role="tabpanel"
        aria-label="실시간 정리"
        hidden={tab !== "context"}
        className={cn(
          "flex min-h-0 flex-1",
          tab !== "context" && "hidden",
          foldedOnNarrow && "max-lg:hidden"
        )}
      >
        <ContextRail onEvidenceSelect={onEvidenceSelect} />
      </div>

      <div
        role="tabpanel"
        aria-label="이 회의"
        hidden={tab !== "shared"}
        className={cn(
          "flex min-h-0 flex-1",
          tab !== "shared" && "hidden",
          foldedOnNarrow && "max-lg:hidden"
        )}
      >
        <SharedChatPanel
          noteId={noteId}
          phase={phase}
          onTurnActiveChange={onSharedTurnActiveChange}
        />
      </div>

      {/* 셸의 개인 챗봇 패널이 이 안으로 들어온다. 비어 있는 동안에도 자리는 남긴다. */}
      <div
        ref={setSlot}
        role="tabpanel"
        aria-label="내 에이전트"
        hidden={tab !== "personal"}
        className={cn(
          "flex min-h-0 flex-1",
          tab !== "personal" && "hidden",
          foldedOnNarrow && "max-lg:hidden"
        )}
      />
    </div>
  );
}

function RailTabButton({
  active,
  onSelect,
  icon,
  label,
}: {
  active: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-chip px-2.5 text-[11px] transition-colors lg:h-8",
        active
          ? "bg-[var(--el-surface-strong)] font-semibold text-[var(--el-ink)]"
          : "text-[var(--el-body)] hover:bg-[var(--el-canvas-soft)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
