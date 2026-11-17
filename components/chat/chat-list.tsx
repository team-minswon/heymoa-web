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
  titlePending?: boolean;
  titleAwaited?: boolean;
  label: RunningLabel | null;
  updatedAt: string;
};

const SHOW_MENU =
  "group-hover/chat:opacity-100 group-has-[:focus-visible]/chat:opacity-100 group-has-[[data-popup-open]]/chat:opacity-100 group-data-[current]/chat:opacity-100 [@media(hover:none)]:opacity-100";
const HIDE_META =
  "group-hover/chat:opacity-0 group-has-[:focus-visible]/chat:opacity-0 group-has-[[data-popup-open]]/chat:opacity-0 group-data-[current]/chat:opacity-0 [@media(hover:none)]:opacity-0";

const LABEL_TONE =
  "rounded-full bg-[var(--el-scope-project-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--el-scope-project)]";

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
  onDelete?: (chat: ChatListRow) => void;
  onRename?: (chatId: string, title: string) => void;
  onNewChat?: () => void;
  editingId: string | null;
  onEditingChange: (chatId: string | null) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const now = new Date();
  const t = useTranslations("chat");
  const locale = useLocale();
  const tDates = useTranslations("dates");
  const setEditingId = onEditingChange;
  const rows = useFrozenRows(chats, editingId !== null);
  const groups = groupChatsByRecency(rows, now);
  const keepFocus = useRef(false);
  const hasMenu = Boolean(onDelete || onRename);
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
              {t(`history.groups.${group.key}`)}
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
                      aria-current={current || undefined}
                      onClick={() => onSelect(chat.chatId)}
                      className={cn(
                        "flex h-10 w-full items-center gap-3 rounded-block pr-2 pl-3 text-left outline-none pointer-coarse:h-12",
                        "focus-visible:ring-3 focus-visible:ring-ring/50",
                        "transition-colors duration-150 motion-reduce:transition-none",
                        current
                          ? "bg-[var(--el-surface-strong)]"
                          : "hover:bg-[var(--el-canvas-soft)]"
                      )}
                    >
                      {chat.titlePending ? (
                        <span
                          key="pending"
                          aria-busy
                          aria-label={t("titlePending")}
                          className={cn(
                            "chat-shimmer min-w-0 flex-1 truncate text-sm",
                            current && "font-medium"
                          )}
                        >
                          {t("newChat")}
                        </span>
                      ) : (
                        <span
                          key="title"
                          title={chat.title}
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm text-[var(--el-ink)]",
                            chat.titleAwaited && "chat-title-in",
                            current && "font-medium"
                          )}
                        >
                          {chat.title}
                        </span>
                      )}
                      <span
                        className={cn(
                          "flex min-w-8 shrink-0 justify-end transition-opacity duration-150 motion-reduce:transition-none",
                          hasMenu && HIDE_META
                        )}
                      >
                        {chat.label ? (
                          <span className={LABEL_TONE}>
                            {t(`running.${chat.label}`)}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--el-muted)] tabular-nums">
                            {relativeUpdatedAt(
                              chat.updatedAt,
                              now,
                              tDates,
                              locale
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  )}
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
              loadingLabel={t("history.loadingMore")}
              onClick={onLoadMore}
            >
              {t("history.loadMore")}
            </LoadMoreButton>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}

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
  const tActions = useTranslations("common.actions");
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
          <span>{tActions("rename")}</span>
        </DropdownMenuItem>
      ) : null}
      {onDelete ? (
        <DropdownMenuItem
          variant="destructive"
          onClick={onDelete}
          className="gap-2 rounded-control py-2 text-[13px] text-destructive pointer-coarse:py-3"
        >
          <Trash2 aria-hidden className="size-4" />
          <span>{tActions("delete")}</span>
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuContent>
  );
}

export function useFrozenRows(
  chats: ChatListRow[],
  frozen: boolean
): ChatListRow[] {
  const [snapshot, setSnapshot] = useState<ChatListRow[] | null>(null);
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
      return current ? { ...current, updatedAt: row.updatedAt } : row;
    }),
  ];
}
