"use client";

import { track } from "@/lib/analytics/track";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";

import { STARTERS } from "@/components/chat/chat-starter";
import { useAuthUserId } from "@/components/auth/auth-provider";
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
export function AgentFab({
  hidden,
  onOpen,
  className,
}: {
  hidden: boolean;
  onOpen: () => void;
  /** 열림·닫힘 움직임. 패널과 같은 길이로 물러나야 해서 호출부가 준다 */
  className: string;
}) {
  const { visible, dismiss } = useAgentIntro();
  const showIntro = visible && !hidden;

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
      {/* 카드가 떠 있을 때는 카드가 말하므로 툴팁을 끈다 */}
      <Tooltip disabled={showIntro}>
        <TooltipTrigger
          render={
            <Button
              size="xl"
              aria-label="내 에이전트 열기"
              aria-hidden={hidden || undefined}
              inert={hidden}
              tabIndex={hidden ? -1 : undefined}
              onClick={open}
              className={cn(
                "fixed right-8 bottom-8 z-40 h-11 rounded-full pr-5 pl-4 shadow-e2",
                className
              )}
            />
          }
        >
          {showIntro ? (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 -z-10 rounded-full bg-[var(--el-ink)]/15 motion-safe:animate-pulse"
            />
          ) : null}
          <MessageCircle aria-hidden className="size-4" />내 에이전트
        </TooltipTrigger>
        <TooltipContent side="top" align="end">
          회의록을 찾고 할 일을 만들어 줘요
        </TooltipContent>
      </Tooltip>
    </>
  );
}
