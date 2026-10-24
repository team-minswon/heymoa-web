"use client";

import { track } from "@/lib/analytics/track";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";

import { STARTERS } from "@/components/chat/chat-starter";
import { useAuthUserId } from "@/components/auth/auth-provider";
import { useAgentNudge } from "@/components/chat/use-agent-nudge";
import { useIsRecordingBusy } from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { readUserFlag, writeUserFlag } from "@/lib/storage/user-flags";
import { cn } from "@/lib/utils";

/**
 * 안내를 닫은 사용자의 표시(`lib/storage/user-flags`). 값은 의미 없이 있으면 닫은 것이다.
 * **저장소를 못 읽으면 닫힌 것으로 본다** — 못 읽는 브라우저에서는 매번 뜨는 안내가 되기 때문이다.
 */
function readDismissed(userId: string | undefined) {
  if (!userId) return true;
  // 없을 때(null)만 처음이다. 값이 있거나 못 읽으면(undefined) 닫힌 것으로 본다.
  return readUserFlag(userId, "agentIntroDismissed") !== null;
}

const subscribeNothing = () => () => {};

/**
 * 처음 온 사람에게 안내 카드를 보일지. 서버 스냅샷은 「닫힘」이라 첫 렌더에서 저장소를 읽지 않고
 * (하이드레이션이 어긋나지 않는다), 마운트 뒤에 저장소 값으로 바뀐다. 쓰기가 막혀도 이번 방문 안에서는
 * 상태로 닫힌다.
 */
function useAgentIntro() {
  const userId = useAuthUserId();
  const dismissedBefore = useSyncExternalStore(
    subscribeNothing,
    () => readDismissed(userId),
    () => true
  );
  const [closed, setClosed] = useState(false);

  const dismiss = useCallback(() => {
    setClosed(true);
    // 못 적어도 이번 방문은 닫혔다
    if (userId) writeUserFlag(userId, "agentIntroDismissed", "1");
  }, [userId]);

  return { visible: !dismissedBefore && !closed, dismiss };
}

/**
 * 우하단 에이전트 버튼. 아이콘만 있던 원을 이름이 적힌 알약으로 바꾸고, 이 브라우저에서 처음이면 하는 일을
 * 알리는 카드를 띄운다. 패널이 열려 버튼이 물러나면(`hidden`) 카드도 함께 보이지 않는다.
 */
/** 패널이 닫힌 동안 알약이 알릴 턴 상태. 승인 대기는 놓치면 일이 멈추므로 따로 말한다. */
export type AgentAttention = "running" | "approval" | null;

const ATTENTION_TEXT: Record<Exclude<AgentAttention, null>, string> = {
  running: "답을 준비하고 있어요",
  approval: "확인이 필요해요",
};

export function AgentFab({
  hidden,
  engaged = false,
  attention = null,
  onOpen,
  className,
}: {
  hidden: boolean;
  /** 닫힌 패널에서 턴이 도는 중이거나 승인을 기다린다. 알약 오른쪽 위에 점을 단다. */
  attention?: AgentAttention;
  /** 이 버튼 밖(노트 레일 등)에서 에이전트를 이미 써 봤다 */
  engaged?: boolean;
  onOpen: () => void;
  /** 열림·닫힘 움직임. 패널과 같은 길이로 물러나야 해서 호출부가 준다 */
  className: string;
}) {
  const { visible, dismiss } = useAgentIntro();
  const showIntro = visible && !hidden;
  // 사용자가 hover·포커스로 말풍선을 열었는가(말풍선은 그때만 뜬다). 그동안은 파동을 멈춘다
  const [userOpen, setUserOpen] = useState(false);
  // 한 번 열어 본 사람은 이 방문에서 더 부르지 않는다. 안내 카드가 보이는 동안(`showIntro`)도 시작하지 않는다 — 카드 > 파동
  const [opened, setOpened] = useState(false);
  if (engaged && !opened) setOpened(true);
  const busy = useIsRecordingBusy();
  const nudging = useAgentNudge(
    !hidden && !showIntro && !userOpen && !opened && !busy
  );

  // 카드가 떠 있는 동안만 Esc 를 듣는다. 다른 것이 이미 Esc 를 먹었으면 건드리지 않는다
  useEffect(() => {
    if (!showIntro) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dismiss, showIntro]);

  const open = () => {
    track("agent_opened", { surface: "fab" });
    dismiss();
    setOpened(true);
    onOpen();
  };

  return (
    <>
      {showIntro ? (
        <section
          data-testid="agent-intro"
          aria-label="내 에이전트 안내"
          className="fixed right-8 bottom-[5.25rem] z-40 w-[min(20rem,calc(100vw-4rem))] rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] p-4 shadow-e2 transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none"
        >
          <h2 className="text-lg text-[var(--el-ink)]">내 에이전트</h2>
          <p className="mt-1 text-xs leading-relaxed text-balance text-[var(--el-muted)]">
            회의록을 보고 답해요. 바꾸는 일은 먼저 물어봐요.
          </p>
          <ul className="mt-3 grid gap-2">
            {STARTERS.map(({ key, Icon, title }) => (
              <li
                key={key}
                className="flex items-center gap-2 text-[13px] text-[var(--el-body)]"
              >
                <Icon
                  aria-hidden
                  className="size-4 shrink-0 text-[var(--el-muted)]"
                />
                {title}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-control px-1 py-1 text-xs text-[var(--el-muted)] underline-offset-2 hover:text-[var(--el-ink)] hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              다시 보지 않기
            </button>
            <Button
              size="sm"
              className="h-8 rounded-full px-3.5"
              onClick={open}
            >
              열어 보기
            </Button>
          </div>
        </section>
      ) : null}
      {attention ? (
        <span id="agent-fab-attention" className="sr-only">
          {ATTENTION_TEXT[attention]}
        </span>
      ) : null}
      {/* 카드가 떠 있을 때는 카드가 말하므로 툴팁을 끈다 */}
      <Tooltip disabled={showIntro} onOpenChange={setUserOpen}>
        <TooltipTrigger
          render={
            <Button
              size="xl"
              aria-label="내 에이전트 열기"
              // 이름은 그대로 두고 상태는 설명으로 덧붙여 읽힌다
              aria-describedby={attention ? "agent-fab-attention" : undefined}
              data-nudge={nudging || undefined}
              aria-hidden={hidden || undefined}
              inert={hidden}
              tabIndex={hidden ? -1 : undefined}
              onClick={open}
              className={cn(
                "group/fab fixed right-8 bottom-8 z-40 h-11 gap-1.5 rounded-full pr-5 pl-4 shadow-e2",
                className
              )}
            />
          }
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-full group-data-[nudge]/fab:motion-safe:animate-[fab-ring_1.3s_ease-out_3]"
          />
          {showIntro ? (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 -z-10 rounded-full bg-[var(--el-ink)]/15 motion-safe:animate-pulse"
            />
          ) : null}
          <MessageCircle aria-hidden className="size-4" />내 에이전트
          {attention ? (
            <>
              <span
                aria-hidden
                data-attention={attention}
                className={cn(
                  "absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--el-surface-card)]",
                  attention === "approval"
                    ? "bg-[var(--el-warning-strong)]"
                    : "bg-[var(--el-scope-note)] motion-safe:animate-pulse"
                )}
              />
            </>
          ) : null}
        </TooltipTrigger>
        <TooltipContent side="top" align="end">
          {attention ? ATTENTION_TEXT[attention] : "회의록을 보고 답해요"}
        </TooltipContent>
      </Tooltip>
    </>
  );
}
