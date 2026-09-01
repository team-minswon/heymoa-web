"use client";

import { useEffect, useState } from "react";

import { usePersonalChat } from "@/components/chat/personal-chat";
import { ContextRail } from "@/components/notes/context-rail";
import { cn } from "@/lib/utils";

export type RailTab = "context" | "personal";

/**
 * 노트 전체 화면의 오른쪽 레일. design.pen `L4PpR` — 위에 「실시간 정리 / 내 에이전트」 탭,
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
  tab,
  onTabChange,
  foldedOnNarrow,
  onEvidenceSelect,
  meetingEnded = false,
}: {
  /** 좁은 화면에서 레일을 접을지가 이 값에 걸려 있어서 소유자는 `NotePanel`이다. */
  tab: RailTab;
  onTabChange: (tab: RailTab) => void;
  /**
   * 좁은 화면에서 대화를 접었는가. **탭 줄은 접지 않는다** — 레일을 통째로 감추면 「내
   * 에이전트」를 고를 버튼까지 같이 감춰져서 종료된 회의에는 들어갈 길이 없어진다.
   */
  foldedOnNarrow: boolean;
  /** 근거를 누르면 전사로 옮겨 그 발화를 짚는다. 소유자는 `NotePanel`이다. */
  onEvidenceSelect: (segmentId: string) => void;
  /** 종료된 회의의 레일 문구는 진행형이면 안 된다 — `ContextRail`로 그대로 내린다. */
  meetingEnded?: boolean;
}) {
  const { setRailSlot } = usePersonalChat();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  // **고른 동안에만** 자리를 넘긴다. 늘 넘기면 노트를 전체 화면으로 열기만 해도 개인 챗봇이
  // 마운트되어 조회가 걸린다 — 「열기 전에는 조회하지 않는다」는 규칙이 깨진다.
  useEffect(() => {
    setRailSlot(tab === "personal" ? slot : null);
    return () => setRailSlot(null);
  }, [setRailSlot, slot, tab]);

  /**
   * **WAI-ARIA 탭 계약.** `role="tab"`을 손으로 붙였으면 키보드도 손으로 붙여야 한다 —
   * 안 그러면 스크린리더가 「탭 목록」이라고 알리는데 방향키가 안 먹는다.
   *
   * 셋을 배열로 모으는 이유는 roving tabIndex와 방향키가 **순서를 알아야** 하기 때문이다.
   */
  const tabs: Array<{ value: RailTab; label: string; icon?: React.ReactNode }> = [
    { value: "context", label: "실시간 정리" },
    { value: "personal", label: "내 에이전트" },
  ];
  const activeIndex = tabs.findIndex((item) => item.value === tab);

  /**
   * 방향키로 옮기면 **선택도 함께 바뀐다**(automatic activation). 이 레일의 패널은 전부
   * 마운트된 채 숨겨져 있어 전환 비용이 없으므로, 화살표만 눌러도 내용이 따라오는 쪽이
   * 손이 덜 간다. `Home`·`End`는 양 끝이다.
   */
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? activeIndex >= last
          ? 0
          : activeIndex + 1
        : event.key === "ArrowLeft"
          ? activeIndex <= 0
            ? last
            : activeIndex - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onTabChange(tabs[next].value);
    // 포커스도 따라가야 한다 — 안 옮기면 다음 화살표가 옛 탭에서 계산된다.
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div
        role="tablist"
        aria-label="에이전트"
        aria-orientation="horizontal"
        onKeyDown={onTabKeyDown}
        // 좁은 화면의 레일 레인은 14rem이라 크롬이 그만큼 대화를 깎는다 — lg 아래에서는 조인다.
        className="flex shrink-0 items-center gap-1 border-b border-[var(--el-hairline)] px-2 py-1.5 lg:p-3"
      >
        {tabs.map((item) => (
          <RailTabButton
            key={item.value}
            value={item.value}
            active={item.value === tab}
            onSelect={() => onTabChange(item.value)}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </div>

      {/* 범위 한 줄 — 누가 이 대화를 보는지를 말한다.
          **「실시간 정리」에는 두지 않는다.** 그 레일은 바로 아래에 제 설명(「끝난 발화에서
          남길 만한 변화만 쌓입니다」)을 이미 달고 있어서, 여기까지 문장을 세우면 탭을
          누르자마자 안내가 두 줄로 겹친다. 개인 챗은 그런 줄이 없어 이 한 줄이 유일하게
          범위를 말한다 — 남의 눈에 안 보인다는 사실은 화면 어디에도 다시 안 나온다. */}
      {tab === "personal" ? (
        <p
          className={cn(
            "shrink-0 px-3 py-1 text-[11px] font-medium text-[var(--el-body)] lg:py-2",
            foldedOnNarrow && "max-lg:hidden"
          )}
        >
          나만 보는 대화 · 현재 회의 범위
        </p>
      ) : null}

      <div
        role="tabpanel"
        id={railPanelId("context")}
        aria-labelledby={railTabId("context")}
        hidden={tab !== "context"}
        className={cn(
          "flex min-h-0 flex-1",
          tab !== "context" && "hidden",
          foldedOnNarrow && "max-lg:hidden"
        )}
      >
        <ContextRail
          onEvidenceSelect={onEvidenceSelect}
          meetingEnded={meetingEnded}
        />
      </div>

      {/* 셸의 개인 챗봇 패널이 이 안으로 들어온다. 비어 있는 동안에도 자리는 남긴다. */}
      <div
        ref={setSlot}
        role="tabpanel"
        id={railPanelId("personal")}
        aria-labelledby={railTabId("personal")}
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

export function railTabId(value: RailTab) {
  return `rail-tab-${value}`;
}
export function railPanelId(value: RailTab) {
  return `rail-panel-${value}`;
}

function RailTabButton({
  value,
  active,
  onSelect,
  icon,
  label,
}: {
  value: RailTab;
  active: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={railTabId(value)}
      aria-controls={railPanelId(value)}
      aria-selected={active}
      // **roving tabIndex.** 셋 다 0이면 Tab 으로 셋을 다 지나야 한다 — 탭 목록은 하나의
      // 정거장이고 그 안 이동은 방향키다.
      tabIndex={active ? 0 : -1}
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
