"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { THINKING, useDemoCopy, type Demo } from "@/components/heymoa/landing/use-demo";
import { cn } from "@/lib/utils";

import { Composer, ScopeChip, ThreadTitle, UserBubble } from "./app";
import { AnswerRefs } from "./app-client";
import { APP, MARKER_DRAW } from "./tokens";

function RailHead({ marked }: { marked: boolean }) {
  const t = useTranslations("landing.app.rail");
  return (
    <div className={cn("flex h-11 shrink-0 items-center gap-2 border-b px-4 lg:h-12", APP.line)}>
      <Sparkles aria-hidden className={cn("size-[15px] shrink-0", APP.ink)} />
      <span className={cn("shrink-0 text-[13px] font-semibold", APP.ink)}>{t("title")}</span>
      <span className={cn("min-w-0 truncate text-[12px]", APP.muted)}>
        <span className={marked ? cn(MARKER_DRAW, APP.ink) : undefined}>{t("private")}</span>
        {` · ${t("scope")}`}
      </span>
    </div>
  );
}

function usePinLast(count: number, done: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const placed = useRef({ count: -1, top: 0 });
  useEffect(() => {
    const el = ref.current;
    const last = el?.lastElementChild;
    if (!el || !(last instanceof HTMLElement)) return;
    const top = parseFloat(getComputedStyle(el).paddingTop) || 0;
    const bottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    el.style.setProperty("--slack", `${el.clientHeight - top - bottom}px`);
    const pin = count > 1 ? last.offsetTop - top : 0;
    const end = last.lastElementChild;
    const fit =
      count > 1 && done && end instanceof HTMLElement
        ? end.offsetTop + end.offsetHeight + bottom - el.clientHeight
        : 0;
    if (count === placed.current.count && Math.abs(el.scrollTop - placed.current.top) > 2) return;
    el.scrollTop = Math.max(pin, fit);
    placed.current = { count, top: el.scrollTop };
  }, [count, done]);
  return ref;
}

export function HeroRail({ demo, asking }: { demo: Demo; asking: boolean }) {
  const { turns, typing, typingAt } = demo;
  const t = useTranslations("landing.demo");
  const { title, threadTitle } = useDemoCopy();
  const streaming =
    typing !== null && typingAt >= 0 && typing < (turns[typingAt]?.a.length ?? 0);
  const threadRef = usePinLast(turns.length, !streaming);
  const chip = <ScopeChip kind="note" title={title} />;

  return (
    <>
      <RailHead marked={asking} />
      <ThreadTitle
        title={threadTitle}
        className="hidden pl-4 lg:flex lg:[@media(max-height:890px)]:hidden"
      />
      <div
        ref={threadRef}
        data-view="14"
        className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4 [mask-image:linear-gradient(to_bottom,#000_calc(100%-14px),transparent)] lg:pt-4"
      >
        {turns.map((turn, i) => {
          const running = streaming && i === typingAt;
          return (
            <div
              key={turn.key}
              className={cn(
                "flex shrink-0 flex-col gap-2.5 last:min-h-[var(--slack,0px)]",
                i > 0 && "chat-rise"
              )}
            >
              <UserBubble chip={chip}>{turn.q}</UserBubble>
              {running && typing === THINKING ? (
                <p className="chat-shimmer m-0 text-[14px]">{t("thinking")}</p>
              ) : (
                <p
                  aria-hidden={running || undefined}
                  className={cn("m-0 text-[14px] leading-[1.65]", APP.body)}
                >
                  {running ? turn.a.slice(0, typing ?? 0) : turn.a}
                  {running ? (
                    <span
                      aria-hidden
                      className="tv-caret ml-0.5 inline-block h-4 w-px bg-[var(--el-muted)] align-middle"
                    />
                  ) : null}
                </p>
              )}
              {running || turn.refs.length === 0 ? null : (
                <div data-refs={i === turns.length - 1 ? "" : undefined}>
                  <AnswerRefs refs={turn.refs} className={i > 0 ? "chat-rise" : undefined} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Composer
        chip={chip}
        busy={streaming}
        className="mx-5 mb-4 border-transparent bg-[var(--el-canvas)] lg:mx-4"
      />
    </>
  );
}
