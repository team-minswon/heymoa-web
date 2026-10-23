"use client";

import { ArrowLeft, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LoadMoreButton } from "@/components/ui/load-more-button";
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
  onDelete,
  onBack,
  backRef,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: {
  chats: ChatListRow[];
  currentChatId: string | null;
  onSelect: (chatId: string) => void;
  /** 그 줄의 휴지통. 확인은 부르는 쪽이 띄운다(APP-1409). 없으면 휴지통을 안 그린다. */
  onDelete?: (chat: ChatListRow) => void;
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
          className="flex w-full items-center gap-2 rounded-block px-3 py-2.5 text-left text-sm text-[var(--el-ink)] outline-none hover:bg-[var(--el-surface-strong)] focus-visible:ring-3 focus-visible:ring-ring/50"
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
                // 줄 버튼과 휴지통은 형제다 — 버튼 안에 버튼을 못 둔다. 휴지통은 줄에 올리거나 포커스가 닿으면 보인다.
                <div key={chat.chatId} className="group/chat relative">
                  <button
                    type="button"
                    // 선택을 색만으로 말하지 않는다.
                    aria-current={chat.chatId === currentChatId || undefined}
                    onClick={() => onSelect(chat.chatId)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-block px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      // 휴지통이 덮는 자리만큼 비운다
                      onDelete && "pr-10",
                      "transition-colors duration-150 motion-reduce:transition-none",
                      // 평소에는 배경이 없어야 hover·선택·선택+hover 셋이 안 뭉개진다.
                      chat.chatId === currentChatId
                        ? "bg-[var(--el-hairline)] font-medium"
                        : "hover:bg-[var(--el-surface-strong)]"
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
                  {onDelete ? (
                    <button
                      type="button"
                      aria-label="대화 삭제"
                      title="대화 삭제"
                      onClick={() => onDelete(chat)}
                      className={cn(
                        "absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-block text-[var(--el-muted)] outline-none",
                        "hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50",
                        "opacity-0 transition-opacity duration-150 group-hover/chat:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
                      )}
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
          {hasMore && onLoadMore ? (
            <div className="flex justify-center py-3">
              <LoadMoreButton
                loading={isLoadingMore}
                loadingLabel="이전 대화 불러오는 중"
                onClick={onLoadMore}
              >
                이전 대화 더 보기
              </LoadMoreButton>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </>
  );
}
