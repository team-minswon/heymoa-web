"use client";

import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  /**
   * 마지막으로 쓴 시각. **정렬 기준과 같은 값이다** — 다른 값을 그리면 「1분 전인데 왜
   * 세 번째 줄」이 된다.
   */
  updatedAt: string;
};

/**
 * 대화 기록. **패널은 하나이고 그 안에서 대화를 갈아 끼운다** — 스레드와 이 목록이 헤더
 * 아래 **같은 자리를 나눠 쓰고** 흐려지며 교대한다.
 *
 * 예전에는 헤더의 드롭다운 메뉴였다. 뜨는 레이어라 패널 밖으로 나가 좁은 폭에서 잘렸고,
 * 목록에 날짜·시각처럼 한 줄이 넘는 것을 담을 자리가 없었다.
 *
 * **답이 흐르는 중에도 열린다.** 앞 대화를 죽이지 않는 것이 이 작업의 전부라, 여기서
 * 잠그면 「대화가 여럿 산다」가 화면에서 사라진다. 서버의 턴은 계속 돌고, 돌아오면
 * `activeTurn` 으로 이어받는다.
 *
 * **포커스는 부모가 옮긴다.** 뷰가 갈리는 것은 부모가 아는 사실이고, 드롭다운 라이브러리가
 * 해 주던 일을 이제 아무도 안 해 준다 — `backRef` 가 그 손잡이다.
 */
export function ChatList({
  chats,
  currentChatId,
  onSelect,
  onBack,
  backRef,
}: {
  chats: ChatListRow[];
  currentChatId: string | null;
  onSelect: (chatId: string) => void;
  onBack: () => void;
  backRef?: React.Ref<HTMLButtonElement>;
}) {
  /**
   * 「지금」을 **한 번만 읽는다.** 줄마다 `Date.now()`를 부르면 같은 목록 안에서 기준이
   * 어긋난다. 목록은 5초 폴링으로 다시 그려지므로 이 값도 그때 새로 잡힌다.
   */
  const now = new Date();
  const groups = groupChatsByRecency(chats, now);

  return (
    <>
      {/* **줄 전체가 누르는 곳이다.** 아이콘만 버튼이면 맞출 곳이 24px 뿐이다.
          「기록」이라는 제목은 안 둔다 — 아래가 이미 날짜로 묶인 대화 목록이라 무엇을
          보고 있는지 스스로 말하고, 같은 줄에 제목을 두면 누르는 곳이 다시 흐려진다. */}
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
            // 줄 사이는 살짝(2px), 묶음 사이는 그보다 넓게(위 12px). 줄 간격이 묶음
            // 간격만큼 벌어지면 묶음 경계가 안 보인다.
            <section key={group.key} className="flex flex-col gap-0.5">
              {/* 스레드의 날짜 구분선과 같은 줄을 쓴다 — 두 곳이 다른 모양이면 같은
                  화면에서 따로 논다. */}
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
                  // ★ **색만으로 말하지 않는다.** 배경은 스크린리더가 못 읽고 색을 가리기
                  // 어려운 사람에게도 안 보인다 — 체크 아이콘이 하던 일을 이게 이어받는다.
                  aria-current={chat.chatId === currentChatId || undefined}
                  onClick={() => onSelect(chat.chatId)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-block px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    // **배경만 부드럽게 한다.** 크기·위치가 함께 움직이면 목록이 출렁인다.
                    "transition-colors duration-150 motion-reduce:transition-none",
                    // 평소 · hover · 선택 · 선택+hover 넷이 서로 안 뭉개져야 한다.
                    // **평소는 배경이 아예 없다** — 셋만 배경을 쓰면 저절로 갈린다.
                    // 선택 위의 hover 는 `Button` 의 secondary 가 쓰는 것과 같은 방식으로
                    // 한 단계 더 진해진다.
                    chat.chatId === currentChatId
                      ? "bg-[var(--el-surface-strong)] hover:bg-[color-mix(in_oklch,var(--el-surface-strong),var(--el-ink)_8%)]"
                      : "hover:bg-[var(--el-canvas-soft)]"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--el-ink)]">
                    {chat.title}
                  </span>
                  {chat.label ? (
                    <Badge variant="secondary" className="shrink-0">
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
        </div>
      </ScrollArea>
    </>
  );
}
