"use client";

import { useTranslations } from "next-intl";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, Copy } from "lucide-react";

import { FOCUS } from "@/components/heymoa/landing/tokens";
import { trackHelp, useHelpSlug } from "@/lib/help/analytics";
import { copyText } from "@/lib/ui/copy-text";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

/**
 * 탭. 서버가 **모든 탭의 내용을 그려 보내서** 스크립트 없이도 다 읽힌다(탭 이름이 작은 제목으로 선다).
 * 하이드레이션 뒤에만 탭 목록이 서고 고른 탭의 내용만 보인다. 방향키 · Home · End 로 옮긴다.
 */
export function HelpTabsView({
  titles,
  panels,
}: {
  titles: string[];
  panels: ReactNode[];
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const [active, setActive] = useState(0);
  const t = useTranslations("help.md");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (event: KeyboardEvent, from: number) => {
    const last = titles.length - 1;
    const next =
      event.key === "ArrowRight"
        ? from === last
          ? 0
          : from + 1
        : event.key === "ArrowLeft"
          ? from === 0
            ? last
            : from - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="rounded-[14px] border border-[var(--tv-rule)] p-4">
      <div
        role="tablist"
        aria-label={t("views")}
        hidden={!ready}
        className="mb-3 flex gap-1 border-b border-[var(--tv-rule)]"
      >
        {titles.map((title, i) => (
          <button
            key={title}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${i}-${title}`}
            aria-selected={i === active}
            aria-controls={`panel-${i}-${title}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(event) => move(event, i)}
            className={cn(
              "-mb-px rounded-t-[8px] border-b-2 px-3 py-2 text-[14px] font-bold help-fade",
              i === active
                ? "border-[var(--tv-brand)] text-[var(--tv-ink)]"
                : "border-transparent text-[var(--tv-muted)] hover:text-[var(--tv-ink)]",
              FOCUS
            )}
          >
            {title}
          </button>
        ))}
      </div>
      {/* 패널을 한 칸에 겹쳐 세워 상자 높이를 가장 긴 탭에 맞춘다(APP-1356). 고른 탭만 그리면 Mac ↔ Windows 를
          오갈 때마다 상자가 72~100px 줄었다 늘어 아래 본문이 통째로 오르내렸다. 안 고른 탭은 `invisible` 이라
          보조기술에도 안 읽힌다. */}
      <div className={cn(ready && "grid")}>
        {panels.map((panel, i) => (
          <div
            key={titles[i]}
            id={`panel-${i}-${titles[i]}`}
            role={ready ? "tabpanel" : undefined}
            aria-labelledby={ready ? `tab-${i}-${titles[i]}` : undefined}
            inert={ready && i !== active}
            className={cn(
              "flex flex-col gap-3",
              ready && "col-start-1 row-start-1",
              ready && i !== active && "invisible",
              i > 0 && !ready && "mt-4"
            )}
          >
            {ready ? null : (
              <strong className="text-[var(--tv-ink)]">{titles[i]}</strong>
            )}
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 코드 블록. 오른쪽 위 복사 버튼. */
export function HelpCodeBlock({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const slug = useHelpSlug();
  const t = useTranslations("help.md");
  return (
    <div className="relative">
      <pre className="m-0 overflow-x-auto rounded-[12px] bg-[var(--tv-lav-soft)] py-3 pr-14 pl-4 font-mono text-[13px] leading-[1.6] text-[var(--tv-ink)]">
        <code>{text}</code>
      </pre>
      <button
        type="button"
        aria-label={t("copy")}
        onClick={async () => {
          try {
            await copyText(text);
            trackHelp("help_code_copied", { slug });
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            /* 복사하지 못해도 글은 그대로 보인다 */
          }
        }}
        className={cn(
          "absolute top-2 right-2 grid size-8 place-items-center rounded-[8px] bg-white text-[var(--tv-muted)] hover:text-[var(--tv-ink)]",
          FOCUS
        )}
      >
        {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
