"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Circle,
  Mic,
  MonitorDown,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

/**
 * 웹과 데스크톱 앱이 무엇이 다른지 세 장으로 보여 준다. **도움말(`/help/desktop`)로 확인된 사실만** 쓴다 —
 * 웹은 마이크 소리만 기록하고, 앱은 컴퓨터에서 나는 소리까지 기록한다. 특정 화상회의 앱 지원은 약속하지 않는다.
 */

function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "on" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium",
        tone === "on"
          ? "bg-[var(--el-ink)] text-white"
          : "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
      )}
    >
      {children}
    </span>
  );
}

function Side({
  title,
  badge,
  sources,
  result,
  highlight,
}: {
  title: string;
  badge: string;
  sources: ReactNode;
  result: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-3 rounded-panel border p-4",
        highlight
          ? "border-[var(--el-ink)] bg-white shadow-sm"
          : "border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--el-ink)]">{title}</p>
        <span className="text-xs text-[var(--el-muted)]">{badge}</span>
      </div>
      <div className="flex flex-col items-start gap-2">{sources}</div>
      <div className="mt-auto flex items-center gap-2 border-t border-[var(--el-hairline)] pt-3 text-[13px] text-[var(--el-muted)]">
        <ArrowRight aria-hidden className="size-4 shrink-0" />
        {result}
      </div>
    </div>
  );
}

function SoundSlide() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row" data-testid="slide-sound">
      <Side
        title="웹"
        badge="브라우저"
        sources={
          <Chip>
            <Mic aria-hidden className="size-4" />내 마이크
          </Chip>
        }
        result="내 목소리만 기록합니다"
      />
      <Side
        highlight
        title="데스크톱 앱"
        badge="Mac · Windows"
        sources={
          <>
            <Chip tone="on">
              <Mic aria-hidden className="size-4" />내 마이크
            </Chip>
            <Chip tone="on">
              <Volume2 aria-hidden className="size-4" />
              컴퓨터에서 나는 소리
            </Chip>
          </>
        }
        result="화상회의 상대방의 목소리까지 담을 수 있습니다"
      />
    </div>
  );
}

function MenuBarSlide() {
  const filters = ["전체", "결정", "할 일", "열린 질문", "참고"];
  return (
    <div className="flex flex-col gap-3" data-testid="slide-menubar">
      <div
        aria-hidden
        className="overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
      >
        <div className="flex items-center justify-end gap-3 border-b border-[var(--el-hairline)] bg-white px-4 py-2 text-xs text-[var(--el-muted)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--el-ink)] px-2.5 py-1 font-medium text-white">
            <Circle className="size-2 fill-red-500 text-red-500" />
            12:34
          </span>
          <span>10월 16일 (금)</span>
        </div>
        <div className="mx-auto my-4 w-[88%] rounded-block border border-[var(--el-hairline)] bg-white p-3 shadow-sm">
          <p className="text-[13px] font-semibold text-[var(--el-ink)]">지금 회의의 타임라인</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.map((f, i) => (
              <span
                key={f}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px]",
                  i === 0
                    ? "bg-[var(--el-ink)] text-white"
                    : "bg-[var(--el-surface-strong)] text-[var(--el-muted)]"
                )}
              >
                {f}
              </span>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-5/6 rounded bg-[var(--el-surface-strong)]" />
            <div className="h-2 w-2/3 rounded bg-[var(--el-surface-strong)]" />
          </div>
        </div>
      </div>
      <ul className="space-y-1.5 text-[13px] leading-6 text-[var(--el-muted)]">
        <li>창의 닫기 버튼을 눌러도 앱은 종료되지 않고 녹음이 이어집니다.</li>
        <li>Mac에서는 메뉴 막대 아이콘으로 지금 회의의 타임라인을 바로 봅니다.</li>
      </ul>
    </div>
  );
}

function InstallSlide() {
  return (
    <div className="flex flex-col gap-3" data-testid="slide-install">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-4">
          <p className="text-sm font-semibold text-[var(--el-ink)]">Mac</p>
          <p className="mt-1 text-[13px] leading-6 text-[var(--el-muted)]">
            macOS 14.2 이상 · Apple Silicon, Intel. Apple 서명·공증을 받은 앱입니다.
          </p>
        </div>
        <div className="rounded-panel border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-4">
          <p className="text-sm font-semibold text-[var(--el-ink)]">Windows (베타)</p>
          <p className="mt-1 text-[13px] leading-6 text-[var(--el-muted)]">
            Windows 11 x64. 서명이 없어 SmartScreen 경고가 뜰 수 있습니다.
          </p>
        </div>
      </div>
      <p className="text-[13px] leading-6 text-[var(--el-muted)]">
        같은 Google 계정으로 로그인하면 웹과 같은 회의 기록을 봅니다. 앱에서도 같은 웹 서비스를 사용합니다.
      </p>
      <Link
        href="/download"
        onClick={() => track("desktop_download_clicked")}
        className={cn(buttonVariants({ variant: "default" }), "w-fit gap-2")}
      >
        <MonitorDown aria-hidden className="size-4" />
        다운로드 페이지로
      </Link>
    </div>
  );
}

const SLIDES = [
  { title: "녹음하는 소리가 다릅니다", body: <SoundSlide /> },
  { title: "창을 닫아도 이어서 기록합니다", body: <MenuBarSlide /> },
  { title: "같은 계정, 같은 기록입니다", body: <InstallSlide /> },
] as const;

export function DesktopCompareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;
  // 어떻게 닫든(X · Esc · 바깥 · 확인) 다음에 열면 첫 장부터 본다.
  const change = (next: boolean) => {
    if (!next) setIndex(0);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>웹과 데스크톱 앱, 무엇이 다른가요?</DialogTitle>
          <DialogDescription>
            {index + 1} / {SLIDES.length} · {slide.title}
          </DialogDescription>
        </DialogHeader>
        <div
          role="group"
          aria-roledescription="슬라이드"
          aria-label={`${index + 1} / ${SLIDES.length}`}
          className="min-h-[248px]"
        >
          {slide.body}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="슬라이드 선택">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${i + 1}번째: ${s.title}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "size-2 cursor-pointer rounded-full transition-colors",
                  i === index ? "bg-[var(--el-ink)]" : "bg-[var(--el-hairline)] hover:bg-[var(--el-muted-soft)]"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft aria-hidden />
              이전
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => (last ? change(false) : setIndex((i) => i + 1))}
            >
              {last ? "확인" : "다음"}
              {last ? null : <ChevronRight aria-hidden />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
