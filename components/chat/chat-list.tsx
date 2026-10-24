"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import {
  CHAT_ICON_BUTTON_LOOK,
  CHAT_ICON_BUTTON_SIZE,
} from "@/components/chat/chat-icon-button";
import { ChatTitleInput } from "@/components/chat/chat-title-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadMoreButton } from "@/components/ui/load-more-button";
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
 * 줄 메뉴(⋯)가 서는 때. 줄에 올렸거나, 줄 안에 키보드 포커스가 있거나, 메뉴가 열렸거나, 지금 보는 대화이거나, 마우스가 없는
 * 화면(터치)이다. ⋯는 시각 자리에 겹쳐 선다 — 따로 칸을 비우면 시각 열이 오른쪽 끝에서 떨어진다.
 */
const SHOW_MENU =
  "group-hover/chat:opacity-100 group-has-[:focus-visible]/chat:opacity-100 group-has-[[data-popup-open]]/chat:opacity-100 group-data-[current]/chat:opacity-100 [@media(hover:none)]:opacity-100";
/** ⋯가 설 때 시각은 물러난다. 둘이 같은 자리라 겹쳐 보이면 안 된다. */
const HIDE_META =
  "group-hover/chat:opacity-0 group-has-[:focus-visible]/chat:opacity-0 group-has-[[data-popup-open]]/chat:opacity-0 group-data-[current]/chat:opacity-0 [@media(hover:none)]:opacity-0";

/** 진행 배지의 색. 「진행 중」과 「승인 대기」는 같은 색이고 글자로 가른다. */
const LABEL_TONE =
  "rounded-full bg-[var(--el-scope-project-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--el-scope-project)]";

/**
 * 대화 기록. 스레드와 같은 자리를 나눠 쓰며 교대한다. 머리글(← 대화 기록)은 패널이 그린다 — 이 안에 뒤로가기 줄을 또 두지 않는다.
 * 답이 흐르는 중에도 열린다. 서버의 턴은 계속 돌고 돌아오면 `activeTurn` 으로 이어받는다.
 */
export function ChatList({
  chats,
  currentChatId,
  onSelect,
  onDelete,
  onRename,
  onNewChat,
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
  /** 빈 기록의 「새 대화」. */
  onNewChat?: () => void;
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
  const locale = useLocale();
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

  if (rows.length === 0 && !hasMore) {
    return (
      <div
        data-testid="chat-history-empty"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-16 text-center"
      >
        <MessageSquare
          aria-hidden
          className="size-5 text-[var(--el-muted-soft)]"
        />
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--el-ink)]">
            {t("history.emptyTitle")}
          </p>
          <p className="text-[13px] leading-relaxed text-[var(--el-muted)]">
            {t("history.emptyBody")}
          </p>
        </div>
        {onNewChat ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-1 rounded-full"
            onClick={onNewChat}
          >
            {t("newChat")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      quietScrollbar
      viewportClassName="overflow-x-hidden"
    >
      <div className="px-2 pt-1 pb-4">
        {groups.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`chat-group-${group.key}`}
            className="flex flex-col gap-px"
          >
            <h3
              id={`chat-group-${group.key}`}
              data-testid="chat-group"
              className="px-3 pt-4 pb-1.5 text-xs font-medium text-[var(--el-muted)]"
            >
              {group.label}
            </h3>
            {group.chats.map((chat) => {
              const current = chat.chatId === currentChatId;
              return (
                <div
                  key={chat.chatId}
                  data-current={current || undefined}
                  className="group/chat relative"
                >
                  {editingId === chat.chatId && onRename ? (
                    <div className="flex h-10 items-center px-1 pointer-coarse:h-12">
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
                      aria-current={current || undefined}
                      onClick={() => onSelect(chat.chatId)}
                      className={cn(
                        "flex h-10 w-full items-center gap-3 rounded-block pr-2 pl-3 text-left outline-none pointer-coarse:h-12",
                        "focus-visible:ring-3 focus-visible:ring-ring/50",
                        "transition-colors duration-150 motion-reduce:transition-none",
                        // 평소에는 배경이 없어야 hover·선택·선택+hover 셋이 안 뭉개진다.
                        current
                          ? "bg-[var(--el-surface-strong)]"
                          : "hover:bg-[var(--el-canvas-soft)]"
                      )}
                    >
                      {/* 잘린 제목은 올려 보면 전체가 보인다 */}
                      <span
                        title={chat.title}
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm text-[var(--el-ink)]",
                          current && "font-medium"
                        )}
                      >
                        {chat.title}
                      </span>
                      {/* 배지와 시각은 한 자리를 나눠 쓴다. 둘 다 서면 좁은 폭에서 제목 자리가 준다. */}
                      <span
                        className={cn(
                          "flex min-w-8 shrink-0 justify-end transition-opacity duration-150 motion-reduce:transition-none",
                          hasMenu && HIDE_META
                        )}
                      >
                        {chat.label ? (
                          <span className={LABEL_TONE}>{chat.label}</span>
                        ) : (
                          <span className="text-xs text-[var(--el-muted)] tabular-nums">
                            {relativeUpdatedAt(chat.updatedAt, now, locale)}
                          </span>
                        )}
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
                          CHAT_ICON_BUTTON_LOOK,
                          CHAT_ICON_BUTTON_SIZE.md,
                          "absolute top-1/2 right-1 -translate-y-1/2 text-[var(--el-muted)] opacity-0 transition-opacity",
                          SHOW_MENU
                        )}
                      >
                        <MoreHorizontal aria-hidden />
                      </DropdownMenuTrigger>
                      <ChatMenuItems
                        onRename={
                          onRename
                            ? () => {
                                keepFocus.current = true;
                                setEditingId(chat.chatId);
                              }
                            : undefined
                        }
                        onDelete={onDelete ? () => onDelete(chat) : undefined}
                        finalFocus={() => {
                          const restore = !keepFocus.current;
                          keepFocus.current = false;
                          return restore;
                        }}
                      />
                    </DropdownMenu>
                  ) : null}
                </div>
              );
            })}
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
  );
}

/**
 * 대화 하나의 메뉴(이름 바꾸기 · 삭제). 기록 줄의 ⋯와 머리글 제목 옆 ⋯가 같은 것을 연다 — 같은 기능은 같은 자리·같은 순서다.
 * 삭제는 부르는 쪽이 확인창을 띄운다.
 */
export function ChatMenuItems({
  onRename,
  onDelete,
  finalFocus,
  align = "end",
}: {
  onRename?: () => void;
  onDelete?: () => void;
  finalFocus?: () => boolean;
  align?: "start" | "end";
}) {
  const t = useTranslations("common.agentChat");
  return (
    <DropdownMenuContent
      align={align}
      className="w-40 rounded-panel"
      finalFocus={finalFocus}
    >
      {onRename ? (
        <DropdownMenuItem
          onClick={onRename}
          className="gap-2 rounded-control py-2 text-[13px] pointer-coarse:py-3"
        >
          <Pencil aria-hidden className="size-4 text-[var(--el-muted)]" />
          <span>{t("rename")}</span>
        </DropdownMenuItem>
      ) : null}
      {onDelete ? (
        <DropdownMenuItem
          variant="destructive"
          onClick={onDelete}
          className="gap-2 rounded-control py-2 text-[13px] text-destructive pointer-coarse:py-3"
        >
          <Trash2 aria-hidden className="size-4" />
          <span>{t("delete")}</span>
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuContent>
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
