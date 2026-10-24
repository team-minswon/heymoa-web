"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { ChatTitleInput } from "@/components/chat/chat-title-input";
import { TimeRule } from "@/components/chat/time-rule";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
/**
 * 줄 메뉴 버튼은 줄에 올리거나 줄 안에 포커스가 있거나 메뉴가 열렸을 때 보인다. 마우스가 없는 화면(터치)에서는 늘 보인다.
 */
const MENU_REVEAL =
  "opacity-0 group-hover/chat:opacity-100 group-has-[:focus-visible]/chat:opacity-100 group-has-[[data-popup-open]]/chat:opacity-100 [@media(hover:none)]:opacity-100";

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
  onRename,
  onBack,
  backRef,
  editingId,
  onEditingChange,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: {
  chats: ChatListRow[];
  currentChatId: string | null;
  onSelect: (chatId: string) => void;
  /** 줄 메뉴의 「삭제」. 확인은 부르는 쪽이 띄운다(APP-1409). */
  onDelete?: (chat: ChatListRow) => void;
  /** 줄 메뉴의 「이름 바꾸기」가 저장한 제목. 비었거나 그대로면 부르지 않는다. */
  onRename?: (chatId: string, title: string) => void;
  onBack: () => void;
  backRef?: React.Ref<HTMLButtonElement>;
  /**
   * 그 자리에서 이름을 고치는 줄. 부르는 쪽이 쥔다 — 그 대화가 실제로 지워졌을 때만 부르는 쪽이 끝낸다. 목록이
   * 다시 읽혀 줄이 빠지거나 자리를 옮겨도 편집은 이어진다.
   */
  editingId: string | null;
  onEditingChange: (chatId: string | null) => void;
  /** 서버에 이 뒤로 더 있다. 목록 끝에 「이전 대화 더 보기」를 둔다. */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  // 「지금」은 한 번만 읽는다. 줄마다 읽으면 같은 목록 안에서 기준이 어긋난다.
  const now = new Date();
  const t = useTranslations("common.agentChat");
  const setEditingId = onEditingChange;
  const rows = useFrozenRows(chats, editingId !== null);
  const groups = groupChatsByRecency(rows, now);
  // 「이름 바꾸기」로 메뉴가 닫힐 때 포커스를 메뉴 버튼으로 돌리면 방금 연 입력이 blur 로 끝난다
  const keepFocus = useRef(false);
  const hasMenu = Boolean(onDelete || onRename);
  // 이름 바꾸기가 끝나면 그 줄의 메뉴 버튼으로 돌아간다. 입력이 사라진 뒤라야 버튼이 다시 선다
  const menuButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterEdit = useRef<string | null>(null);
  useEffect(() => {
    if (editingId !== null || focusAfterEdit.current === null) return;
    menuButtons.current.get(focusAfterEdit.current)?.focus();
    focusAfterEdit.current = null;
  }, [editingId]);

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
                <div key={chat.chatId} className="group/chat relative">
                  {editingId === chat.chatId && onRename ? (
                    <div className="px-1 py-0.5">
                      <ChatTitleInput
                        initial={chat.title}
                        label={t("titleInput")}
                        onSubmit={(title) => onRename(chat.chatId, title)}
                        onDone={(restoreFocus) => {
                          if (restoreFocus)
                            focusAfterEdit.current = chat.chatId;
                          setEditingId(null);
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      // 선택을 색만으로 말하지 않는다.
                      aria-current={chat.chatId === currentChatId || undefined}
                      onClick={() => onSelect(chat.chatId)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-block px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        // 메뉴 버튼이 덮는 자리만큼 비운다
                        hasMenu && "pr-10",
                        "transition-colors duration-150 motion-reduce:transition-none",
                        // 평소에는 배경이 없어야 hover·선택·선택+hover 셋이 안 뭉개진다.
                        chat.chatId === currentChatId
                          ? "bg-[var(--el-hairline)] font-medium"
                          : "hover:bg-[var(--el-surface-strong)]"
                      )}
                    >
                      {/* 잘린 제목은 올려 보면 전체가 보인다 */}
                      <span
                        title={chat.title}
                        className="min-w-0 flex-1 truncate text-sm text-[var(--el-ink)]"
                      >
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
                  )}
                  {/* 줄 버튼과 메뉴 버튼은 형제다 — 버튼 안에 버튼을 못 둔다. */}
                  {hasMenu && editingId !== chat.chatId ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        ref={(button) => {
                          if (button)
                            menuButtons.current.set(chat.chatId, button);
                          else menuButtons.current.delete(chat.chatId);
                        }}
                        aria-label={t("menu", { title: chat.title })}
                        className={cn(
                          "absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-block text-[var(--el-muted)] outline-none",
                          "hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)] focus-visible:ring-3 focus-visible:ring-ring/50",
                          "transition-opacity duration-150 motion-reduce:transition-none",
                          MENU_REVEAL
                        )}
                      >
                        <MoreHorizontal aria-hidden className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-36 rounded-panel"
                        finalFocus={() => {
                          const restore = !keepFocus.current;
                          keepFocus.current = false;
                          return restore;
                        }}
                      >
                        {onRename ? (
                          <DropdownMenuItem
                            onClick={() => {
                              keepFocus.current = true;
                              setEditingId(chat.chatId);
                            }}
                            className="gap-2 rounded-control py-1.5 text-xs"
                          >
                            <Pencil
                              aria-hidden
                              className="size-3.5 text-[var(--el-muted)]"
                            />
                            <span>{t("rename")}</span>
                          </DropdownMenuItem>
                        ) : null}
                        {onDelete ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(chat)}
                            className="gap-2 rounded-control py-1.5 text-xs text-destructive"
                          >
                            <Trash2 aria-hidden className="size-3.5" />
                            <span>{t("delete")}</span>
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
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

/**
 * 편집하는 동안 줄 순서와 묶음을 얼린다. 그 사이 목록이 다시 읽혀(`chats.changed`·폴링) 줄이 다른 묶음으로 옮겨 가면
 * 입력이 다시 마운트되어 쓰던 글자와 포커스를 잃는다. 얼린 동안에도 제목·배지는 최신 값을 쓰고, 새로 생긴 대화는
 * 맨 위에 붙인다(가장 최근이라 늘 첫 묶음이다). 잠시 목록에서 빠진 줄은 얼린 값으로 남긴다 — 지워졌으면 부르는 쪽이
 * 편집을 끝내 얼림이 풀린다.
 */
export function useFrozenRows(
  chats: ChatListRow[],
  frozen: boolean
): ChatListRow[] {
  const [snapshot, setSnapshot] = useState<ChatListRow[] | null>(null);
  // 렌더 중에 맞춘다. effect 로 미루면 얼리기 전의 새 순서로 한 번 그리는 것이 곧 재마운트다
  if (frozen && snapshot === null) setSnapshot(chats);
  if (!frozen && snapshot !== null) setSnapshot(null);
  if (!frozen) return chats;
  const base = snapshot ?? chats;
  const live = new Map(chats.map((chat) => [chat.chatId, chat]));
  const known = new Set(base.map((chat) => chat.chatId));
  return [
    ...chats.filter((chat) => !known.has(chat.chatId)),
    ...base.map((row) => {
      const current = live.get(row.chatId);
      // 묶음을 가르는 시각은 얼린 값을 쓴다 — 최신 시각을 쓰면 줄이 제자리에 있어도 묶음이 쪼개진다
      return current ? { ...current, updatedAt: row.updatedAt } : row;
    }),
  ];
}
