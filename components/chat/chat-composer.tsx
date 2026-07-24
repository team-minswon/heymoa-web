"use client";

import { ArrowUp, Square } from "lucide-react";

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
  footer,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isBusy: boolean;
  isStreaming: boolean;
  placeholder: string;
  footer?: React.ReactNode;
}) {
  return (
    <form
      className="border-t border-[var(--el-hairline)] px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          disabled={isBusy}
          placeholder={placeholder}
          aria-label="메시지"
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="rounded-full"
            aria-label="중지"
            onClick={onStop}
          >
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="rounded-full"
            aria-label="보내기"
            disabled={isBusy}
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
      {footer}
    </form>
  );
}
