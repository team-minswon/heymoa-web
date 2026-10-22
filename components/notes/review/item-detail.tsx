import type { ReactNode } from "react";

import { RoleDot, roleOfItem } from "@/components/notes/review/role-dot";
import type { ReviewItem } from "@/lib/notes/review/sections";
import {
  summaryTopics,
  topicKey,
  type MeetingReviewSummary,
} from "@/lib/notes/review/summary";
import { linkedItemsOf } from "@/lib/notes/review/topics";
import { cn } from "@/lib/utils";

/**
 * 펼친 항목의 속. 붙은 제안(있으면)이 먼저 서고, 그 아래 수정 기록 카드와 관련 항목이다.
 * 요약 보기에서는 줄 아래에 떠 있는 카드라 옅은 그림자를 두고, 그래프의 상세 패널 안에서는 카드 안의
 * 카드라 hairline 만 쓴다.
 */
export function ItemDetail({
  item,
  summary,
  itemsById,
  suggestions,
  trail,
  elevated = false,
  onSelectItem,
  onSelectAgenda,
}: {
  item: ReviewItem;
  summary: MeetingReviewSummary | null;
  itemsById: ReadonlyMap<string, ReviewItem>;
  suggestions?: ReactNode;
  trail: ReactNode;
  elevated?: boolean;
  onSelectItem: (itemId: string) => void;
  onSelectAgenda?: (agendaId: string) => void;
}) {
  // 열 수 있는 항목으로 거른 뒤 넷까지 — 먼저 자르면 앞 넷이 없는 항목일 때 뒤의 것까지 사라진다.
  const agendas = summaryTopics(summary).filter((topic) =>
    topic.memberships.some((member) => member.itemId === item.itemId)
  );
  const linked = linkedItemsOf(summary, item.itemId)
    .flatMap((row) => {
      const other = itemsById.get(row.itemId);
      return other ? [{ ...row, other }] : [];
    })
    .slice(0, 4);

  return (
    <div className="space-y-3">
      {summary?.status === "SUCCEEDED" ? (
        <section aria-label="연결된 안건" className="px-1">
          <h3 className="text-xs font-medium text-[var(--el-muted)]">
            연결된 안건
          </h3>
          {agendas.length > 0 ? (
            <ul className="mt-1.5 space-y-1 border-l-2 border-[var(--el-hairline-strong)] pl-3 text-sm leading-6 text-[var(--el-ink)]">
              {agendas.map((agenda) => (
                <li key={topicKey(agenda)}>
                  {agenda.agendaId && onSelectAgenda ? (
                    <a
                      href={`#summary-agenda-${agenda.agendaId}`}
                      onClick={(event) => {
                        event.preventDefault();
                        onSelectAgenda(agenda.agendaId!);
                      }}
                      className="block py-1 underline decoration-[var(--el-hairline-strong)] underline-offset-4 hover:decoration-current"
                    >
                      {agenda.title}
                    </a>
                  ) : (
                    agenda.title
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-[var(--el-muted)]">없음</p>
          )}
        </section>
      ) : null}
      {suggestions}
      <div
        className={cn(
          "overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)]",
          elevated && "shadow-e2"
        )}
      >
        <div className="px-4 py-3">{trail}</div>
        {linked.length > 0 ? (
          <section
            aria-label="연결된 항목"
            className="border-t border-[var(--el-hairline-soft)] px-4 py-3"
          >
            <h3 className="mb-1 text-xs font-medium text-[var(--el-muted)]">
              연결된 항목
            </h3>
            <ul className="divide-y divide-[var(--el-hairline-soft)]">
              {linked.map((row) => (
                <li key={row.itemId}>
                  <button
                    type="button"
                    onClick={() => onSelectItem(row.itemId)}
                    className="flex w-full items-center gap-2 rounded-control py-2.5 text-left hover:bg-[var(--el-canvas-soft)]"
                  >
                    <RoleDot role={roleOfItem(row.other, summary)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-[var(--el-muted)]">
                        {row.label}
                      </span>
                      <span className="block whitespace-normal break-words text-sm text-[var(--el-ink)] underline decoration-[var(--el-hairline-strong)] underline-offset-4">
                        {row.other.content}
                      </span>
                    </span>
                    <span aria-hidden className="text-[var(--el-muted)]">
                      ↗
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
