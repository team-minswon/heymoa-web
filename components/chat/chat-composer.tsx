"use client";

import { Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 공유 챗봇(노트 트레이)과 개인 챗봇(플로팅)이 함께 쓰는 입력부. 두 챗봇은 같은 대화 UI
 * 프리미티브를 써야 하므로(APP-156) 메시지 행(`ChatThread`)에 이어 입력 form도 하나로 둔다.
 * 스트리밍 중에는 전송이 중지로 바뀐다. 문맥별 안내(승인 대기 등)는 `footer`로 넣는다.
 */
export function ChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  onStop,
  isBusy,
  isStreaming,
  placeholder,
  scopeIcon: ScopeIcon,
  scopeHint,
  sendLabel,
  footer,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isBusy: boolean;
  isStreaming: boolean;
  placeholder: string;
  /** 이 챗이 누구에게 남는지. 보내기 전에 알아야 하는 유일한 것이다. */
  scopeIcon: React.ComponentType<{ className?: string }>;
  scopeHint: string;
  sendLabel: string;
  footer?: React.ReactNode;
}) {
  return (
    <form
      // design.pen `N38wQ` — 레일 안쪽 여백은 14, 위아래 12. 메시지 열과 같은 열에 선다.
      className="flex flex-col gap-2 border-t border-[var(--el-hairline)] px-3.5 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Input
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        disabled={isBusy}
        placeholder={placeholder}
        aria-label="메시지"
        className="h-9"
      />
      {/* 보내기는 입력 **아래 줄**이다(design.pen `EFF1z`·`h2793`). 입력 옆 동그란 화살표는
          「어디로 가는지」를 말할 자리가 없어서, 공유 챗에서 워크스페이스 전체로 나가는 것을
          누르기 전에 알 수 없었다. */}
      <div className="flex h-8 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--el-muted)]">
          <ScopeIcon className="size-3.5 shrink-0" />
          <span className="truncate">{scopeHint}</span>
        </span>
        {isStreaming ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 shrink-0 px-2.5 text-[12px]"
            onClick={onStop}
          >
            <Square className="size-3.5" />
            중지
          </Button>
        ) : (
          <Button
            type="submit"
            className="h-8 shrink-0 px-2.5 text-[12px]"
            disabled={isBusy}
          >
            {sendLabel}
          </Button>
        )}
      </div>
      {footer}
    </form>
  );
}
