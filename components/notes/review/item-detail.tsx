import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { RoleDot, roleOfItem } from "@/components/notes/review/role-dot";
import type { ReviewItem } from "@/lib/notes/review/sections";
import {
  summaryTopics,
  topicKey,
  type MeetingReviewSummary,
} from "@/lib/notes/review/summary";
import { linkedItemsOf } from "@/lib/notes/review/topics";
import { cn } from "@/lib/utils";

const LINK_KINDS: ReadonlySet<string> = new Set([
  "LEADS_TO",
  "SUPPORTS",
  "PROGRESS",
  "RESOLVES",
]);
type LinkKind = "LEADS_TO" | "SUPPORTS" | "PROGRESS" | "RESOLVES";

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
  const t = useTranslations("notes.review.detail");
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
        <section aria-label={t("agendas")} className="px-1">
          <h3 className="text-xs font-medium text-[var(--el-muted)]">
            {t("agendas")}
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
            <p className="mt-1 text-sm text-[var(--el-muted)]">{t("none")}</p>
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
            aria-label={t("linked")}
            className="border-t border-[var(--el-hairline-soft)] px-4 py-3"
          >
            <h3 className="mb-1 text-xs font-medium text-[var(--el-muted)]">
              {t("linked")}
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
                        {LINK_KINDS.has(row.kind)
                          ? t(`links.${row.kind as LinkKind}`)
                          : row.label}
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
