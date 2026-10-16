"use client";

import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { useState } from "react";

import { DesktopDownloadLink } from "@/components/heymoa/desktop-download-link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function SoundComparison() {
  return (
    <table className="w-full table-fixed border-collapse text-[15px]">
      <caption className="sr-only">웹과 데스크톱 앱 녹음 범위 비교</caption>
      <thead>
        <tr className="border-b border-[var(--el-hairline)] text-[13px] text-[var(--el-muted)]">
          <th scope="col" className="w-[56%] pb-3 text-left font-normal">
            녹음하는 소리
          </th>
          <th scope="col" className="pb-3 text-center font-normal">
            웹
          </th>
          <th
            scope="col"
            className="pb-3 text-center font-semibold text-[var(--el-ink)]"
          >
            앱
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-[var(--el-hairline)]">
          <th
            scope="row"
            className="py-5 pr-3 text-left align-middle font-medium text-[var(--el-ink)]"
          >
            마이크로 들어오는 소리
            <span className="mt-1 block text-[13px] leading-5 font-normal text-[var(--el-muted)]">
              내 목소리, 회의실 대화
            </span>
          </th>
          <td className="text-center">
            <Check aria-hidden className="mx-auto size-5" />
            <span className="sr-only">기록 가능</span>
          </td>
          <td className="text-center">
            <Check aria-hidden className="mx-auto size-5" />
            <span className="sr-only">기록 가능</span>
          </td>
        </tr>
        <tr className="border-b border-[var(--el-hairline)]">
          <th
            scope="row"
            className="py-5 pr-3 text-left align-middle font-medium text-[var(--el-ink)]"
          >
            컴퓨터에서 재생되는 소리
            <span className="mt-1 block text-[13px] leading-5 font-normal text-[var(--el-muted)]">
              화상회의 상대방, 강의, 유튜브 영상
            </span>
          </th>
          <td className="text-center text-[var(--el-muted)]">
            <Minus aria-hidden className="mx-auto size-5" />
            <span className="sr-only">기록되지 않음</span>
          </td>
          <td className="text-center">
            <Check aria-hidden className="mx-auto size-5" />
            <span className="sr-only">기록 가능</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const STEPS = [
  {
    title: "기록할 수 있는 소리",
    description: "웹은 마이크 소리, 앱은 컴퓨터 소리까지 기록합니다.",
  },
  {
    title: "창을 닫아도 이어지는 녹음",
    description: "녹음하는 동안 다른 작업을 해도 괜찮습니다.",
  },
  {
    title: "사용하던 기록 그대로",
    description: "웹과 앱은 같은 노트와 프로젝트를 사용합니다.",
  },
] as const;

export function DesktopCompareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const change = (next: boolean) => {
    if (!next) setIndex(0);
    onOpenChange(next);
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto bg-white p-6 sm:max-w-[600px] sm:p-8">
        <DialogHeader className="h-[108px] gap-2 pr-6 sm:h-[64px]">
          <DialogTitle className="font-serif text-[24px] leading-tight font-light tracking-tight">
            {step.title}
          </DialogTitle>
          <DialogDescription>{step.description}</DialogDescription>
        </DialogHeader>
        <div
          className="mt-6 h-[308px] overflow-y-auto"
          role="group"
          aria-label={`${index + 1} / 3`}
        >
          {index === 0 ? (
            <SoundComparison />
          ) : index === 1 ? (
            <div>
              <div
                role="img"
                aria-label="Mac 메뉴 막대에서 녹음 상태와 회의 타임라인을 보는 예시"
                className="overflow-hidden rounded-control border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
              >
                <div
                  aria-hidden
                  className="flex h-9 items-center justify-between border-b border-[var(--el-hairline)] bg-white px-3 text-xs text-[var(--el-muted)]"
                >
                  <span>Mac 메뉴 막대</span>
                  <span className="inline-flex items-center gap-2 rounded-chip bg-[var(--el-surface-strong)] px-2 py-1 text-[var(--el-ink)]">
                    <span className="size-1.5 rounded-full bg-red-500" />
                    녹음 중 · 12:34
                  </span>
                </div>
                <div aria-hidden className="px-6 pt-4 pb-9 sm:px-7">
                  <div className="ml-auto w-[90%] rounded-control border border-[var(--el-hairline)] bg-white p-3 shadow-sm sm:w-[84%]">
                    <p className="text-sm font-medium">
                      주간 회의{" "}
                      <span className="ml-1 font-normal text-[var(--el-muted)]">
                        타임라인
                      </span>
                    </p>
                    <div className="mt-2.5 space-y-2.5 border-t border-[var(--el-hairline)] pt-2.5 text-[13px]">
                      <p className="flex gap-3">
                        <span className="shrink-0 text-[var(--el-muted)]">
                          00:32
                        </span>
                        <span>다음 회의는 금요일에 진행</span>
                      </p>
                      <p className="flex gap-3">
                        <span className="shrink-0 text-[var(--el-muted)]">
                          01:10
                        </span>
                        <span>회의 자료 공유하기</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 break-keep text-[var(--el-muted)]">
                창을 닫아도 녹음은 계속됩니다.
                <span className="block">
                  Mac 메뉴 막대에서 녹음 상태와 타임라인을 확인하세요.
                </span>
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[15px] leading-6">
                앱을 설치한 뒤, 지금 쓰는 Google 계정으로 로그인하세요.
              </p>
              <dl className="my-5 divide-y divide-[var(--el-hairline)] text-sm">
                <div className="flex justify-between gap-4 py-3">
                  <dt className="font-medium">Mac</dt>
                  <dd className="text-[var(--el-muted)]">
                    macOS 14.2 이상 · Apple Silicon, Intel
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt className="font-medium">Windows</dt>
                  <dd className="text-[var(--el-muted)]">Windows 11 x64</dd>
                </div>
              </dl>
              <DesktopDownloadLink
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "h-10 px-4"
                )}
              />
            </div>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between gap-1 border-t border-[var(--el-hairline)] pt-5">
          <nav
            aria-label="데스크톱 앱 안내 단계"
            className="flex shrink-0 items-center gap-1"
          >
            {STEPS.map((item, i) => (
              <Button
                variant="ghost"
                size="icon-sm"
                key={item.title}
                type="button"
                aria-current={index === i ? "step" : undefined}
                aria-label={`${i + 1}. ${item.title}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "size-7 shrink-0 rounded-full border p-0 text-[13px] leading-none font-medium tabular-nums",
                  index === i
                    ? "border-[var(--el-ink)] bg-[var(--el-ink)] text-white hover:bg-[var(--el-ink)] hover:text-white"
                    : "border-[var(--el-hairline)] bg-white text-[var(--el-muted)] hover:bg-[var(--el-surface-strong)]"
                )}
              >
                {i + 1}
              </Button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-[68px] text-sm"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              <ChevronLeft aria-hidden />
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-[68px] text-sm"
              onClick={() =>
                index === STEPS.length - 1 ? change(false) : setIndex(index + 1)
              }
            >
              {index === STEPS.length - 1 ? "확인" : "다음"}
              {index < STEPS.length - 1 ? <ChevronRight aria-hidden /> : null}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
