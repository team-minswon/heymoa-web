"use client";

import { ArrowLeft, Loader2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TimeRule } from "@/components/chat/time-rule";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  groupChatsByRecency,
  relativeUpdatedAt,
  type RunningLabel,
} from "@/lib/chat/chat-list";
import { cn } from "@/lib/utils";

export type ChatListRow = {
  chatId: string;
  title: string;
  /** 진행 배지. null이면 그 대화는 지금 아무것도 안 한다. */
  label: RunningLabel | null;
  /** 마지막으로 쓴 시각. 정렬 기준과 같은 값이어야 순서와 표시가 안 어긋난다. */
  updatedAt: string;
};

/**
 * 진행 배지의 색. 「진행 중」과 「승인 대기」는 같은 색이고 글자로 가른다. `secondary` 는
 * 배경이 선택된 줄과 같아 배지가 사라지므로 범위 칩의 파랑을 빌린다.
 */
const LABEL_TONE =
  "bg-[var(--el-scope-project-soft)] text-[var(--el-scope-project)]";

/**
 * 대화 기록. 스레드와 같은 자리를 나눠 쓰며 교대한다. 답이 흐르는 중에도 열린다 — 서버의
 * 턴은 계속 돌고 돌아오면 `activeTurn` 으로 이어받는다. 포커스는 부모가 `backRef` 로 옮긴다.
 */
export function ChatList({
  chats,
  currentChatId,
  onSelect,
  onBack,
  backRef,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: {
  chats: ChatListRow[];
  currentChatId: string | null;
  onSelect: (chatId: string) => void;
  onBack: () => void;
  backRef?: React.Ref<HTMLButtonElement>;
  /** 서버에 이 뒤로 더 있다. 목록 끝에 「이전 대화 더 보기」를 둔다. */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  // 「지금」은 한 번만 읽는다. 줄마다 읽으면 같은 목록 안에서 기준이 어긋난다.
  const now = new Date();
  const groups = groupChatsByRecency(chats, now);

  return (
    <>
      {/* 줄 전체가 누르는 곳이다. 아이콘만 버튼이면 맞출 곳이 24px 뿐이다. */}
      <div className="border-b border-[var(--el-hairline)] p-2">
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          className="flex w-full items-center gap-2 rounded-block px-3 py-2.5 text-left text-sm text-[var(--el-ink)] outline-none hover:bg-[var(--el-canvas-soft)] focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft aria-hidden className="size-4 shrink-0" />
          뒤로가기
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {groups.map((group) => (
            // 줄 간격이 묶음 간격만큼 벌어지면 묶음 경계가 안 보인다.
            <section key={group.key} className="flex flex-col gap-0.5">
              {/* 스레드의 날짜 구분선과 같은 줄을 쓴다. */}
              <TimeRule
                data-testid="chat-group"
                label={group.label}
                align="start"
                className="px-2 pt-3 pb-1.5"
              />
              {group.chats.map((chat) => (
                <button
                  key={chat.chatId}
                  type="button"
                  // 선택을 색만으로 말하지 않는다.
                  aria-current={chat.chatId === currentChatId || undefined}
                  onClick={() => onSelect(chat.chatId)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-block px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    "transition-colors duration-150 motion-reduce:transition-none",
                    // 평소에는 배경이 없어야 hover·선택·선택+hover 셋이 안 뭉개진다.
                    chat.chatId === currentChatId
                      ? "bg-[var(--el-surface-strong)] hover:bg-[color-mix(in_oklch,var(--el-surface-strong),var(--el-ink)_8%)]"
                      : "hover:bg-[var(--el-canvas-soft)]"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--el-ink)]">
                    {chat.title}
                  </span>
                  {chat.label ? (
                    <Badge
                      variant="secondary"
                      className={cn("shrink-0", LABEL_TONE)}
                    >
                      {chat.label}
                    </Badge>
                  ) : null}
                  <span className="shrink-0 text-[11px] tabular-nums text-[var(--el-muted)]">
                    {relativeUpdatedAt(chat.updatedAt, now)}
                  </span>
                </button>
              ))}
            </section>
          ))}
          {hasMore && onLoadMore ? (
            <div className="flex justify-center py-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={isLoadingMore}
                onClick={onLoadMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2Icon className="animate-spin" /> 불러오는 중
                  </>
                ) : (
                  "이전 대화 더 보기"
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </>
  );
}
