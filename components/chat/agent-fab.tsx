"use client";

import { track } from "@/lib/analytics/track";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

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

function readDismissed(userId: string | undefined) {
  if (!userId) return true;
  return readUserFlag(userId, "agentIntroDismissed") !== null;
}

const subscribeNothing = () => () => {};

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
    if (userId) writeUserFlag(userId, "agentIntroDismissed", "1");
  }, [userId]);

  return { visible: !dismissedBefore && !closed, dismiss };
}

export type AgentAttention = "running" | "approval" | null;

export function AgentFab({
  hidden,
  engaged = false,
  attention = null,
  onOpen,
  className,
}: {
  hidden: boolean;
  attention?: AgentAttention;
  engaged?: boolean;
  onOpen: () => void;
  className: string;
}) {
  const t = useTranslations("chat.fab");
  const tStarter = useTranslations("chat.starter.capabilities");
  const { visible, dismiss } = useAgentIntro();
  const showIntro = visible && !hidden;
  const [userOpen, setUserOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  if (engaged && !opened) setOpened(true);
  const busy = useIsRecordingBusy();
  const nudging = useAgentNudge(
    !hidden && !showIntro && !userOpen && !opened && !busy
  );

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
          aria-label={t("introLabel")}
          className="fixed right-8 bottom-[5.25rem] z-40 w-[min(20rem,calc(100vw-4rem))] rounded-panel border border-[var(--el-hairline)] bg-[var(--el-surface-card)] p-4 shadow-e2 transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none"
        >
          <h2 className="text-lg text-[var(--el-ink)]">{t("title")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-balance text-[var(--el-muted)]">
            {t("intro")}
          </p>
          <ul className="mt-3 grid gap-2">
            {STARTERS.map(({ key, Icon }) => (
              <li
                key={key}
                className="flex items-center gap-2 text-[13px] text-[var(--el-body)]"
              >
                <Icon
                  aria-hidden
                  className="size-4 shrink-0 text-[var(--el-muted)]"
                />
                {tStarter(key)}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-control px-1 py-1 text-xs text-[var(--el-muted)] underline-offset-2 hover:text-[var(--el-ink)] hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t("dismiss")}
            </button>
            <Button
              size="sm"
              className="h-8 rounded-full px-3.5"
              onClick={open}
            >
              {t("open")}
            </Button>
          </div>
        </section>
      ) : null}
      {attention ? (
        <span id="agent-fab-attention" className="sr-only">
          {t(`attention.${attention}`)}
        </span>
      ) : null}
      <Tooltip disabled={showIntro} onOpenChange={setUserOpen}>
        <TooltipTrigger
          render={
            <Button
              size="xl"
              aria-label={t("openLabel")}
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
          <MessageCircle aria-hidden className="size-4" />
          {t("name")}
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
          {attention ? t(`attention.${attention}`) : t("tooltip")}
        </TooltipContent>
      </Tooltip>
    </>
  );
}
