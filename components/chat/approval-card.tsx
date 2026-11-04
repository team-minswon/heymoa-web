"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleHelp,
  Clock,
  ExternalLink,
  Loader2,
  type LucideIcon,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ApprovalCardData,
  ApprovalCardField,
  ApprovalCardStatus,
} from "@/lib/chat/approval-card";
import type { ApprovalDecision } from "@/lib/chat/blocks";
import { cn } from "@/lib/utils";

/** 한 화면에 늘어놓는 일괄 항목 수. 넘으면 나머지를 접는다. */
const ITEMS_SHOWN = 5;
/** 본문을 접는 기준. 미리보기 줄 수(`line-clamp-5`)와 같다. */
const BODY_LINES = 5;
const BODY_CHARS = 280;

type BadgeVariant = "secondary" | "success" | "destructive" | "outline";

/** 배지 이름은 `chat.approval.badges.<label>` 이다. 보낸 뒤(`submitted`)도 확정 전이라 「승인 대기」다. */
const BADGES: Record<
  ApprovalCardStatus["kind"],
  {
    label: Exclude<ApprovalCardStatus["kind"], "submitted">;
    icon: LucideIcon;
    variant: BadgeVariant;
  }
> = {
  open: { label: "open", icon: Clock, variant: "secondary" },
  submitted: { label: "open", icon: Clock, variant: "secondary" },
  running: { label: "running", icon: Loader2, variant: "secondary" },
  done: { label: "done", icon: Check, variant: "success" },
  rejected: { label: "rejected", icon: Minus, variant: "outline" },
  failed: { label: "failed", icon: X, variant: "destructive" },
  invalid: { label: "invalid", icon: Minus, variant: "destructive" },
  check: { label: "check", icon: CircleHelp, variant: "outline" },
};

/** 결정 뒤 상태는 테두리로도 말한다. 결정 전은 진한 테두리로 「지금 답할 것」을 세운다. */
const BORDERS: Record<ApprovalCardStatus["kind"], string> = {
  open: "border-[var(--el-hairline-strong)]",
  submitted: "border-[var(--el-hairline-strong)]",
  running: "border-[var(--el-hairline)]",
  done: "border-[var(--el-success)]/35",
  rejected: "border-dashed border-[var(--el-hairline-strong)]",
  failed: "border-[var(--el-error)]/30",
  invalid: "border-[var(--el-error)]/30",
  check: "border-[var(--el-hairline)]",
};

/** 실행하지 않았거나 결과를 모르는 카드는 무엇을 하려 했는지보다 왜 끝났는지를 말한다(`chat.approval.reasons.<값>`). */
const REASONS: Partial<
  Record<ApprovalCardStatus["kind"], "rejected" | "failed" | "unknown">
> = {
  rejected: "rejected",
  failed: "failed",
  check: "unknown",
};

/**
 * 쓰기 승인 카드. heymoa·Linear·GitHub·메일 모두 이 하나다. 모양은 ai 가 보낸 `card` 가 정하고,
 * 없으면 `summary` 한 줄을 제목 자리에 둔다. 도구 id·인자 원문은 어느 경우에도 그리지 않는다.
 *
 * 모든 값은 평문으로만 그린다 — 마크다운·HTML·링크로 해석하지 않는다. 승인의 근거가 이 화면이라
 * 표시가 위조되면 안 된다.
 */
export function ApprovalCard({
  card,
  summary,
  status,
  onApprove,
}: {
  card: ApprovalCardData | null;
  summary: string | null;
  status: ApprovalCardStatus;
  onApprove?: (decision: ApprovalDecision) => void;
}) {
  const t = useTranslations("chat.approval");
  const asking = status.kind === "open" || status.kind === "submitted";
  const showContent =
    asking || status.kind === "running" || status.kind === "done";
  const badge = BADGES[status.kind];
  const Icon = badge.icon;
  const count = card?.items.length ?? 0;
  // 무엇을 하는지 모르는 쓰기는 승인하게 두지 않는다. 도구 id 로 대신 채우지도 않는다.
  const blind = !card && !summary;
  const fallbackReason = REASONS[status.kind];
  const reason =
    "reason" in status && status.reason
      ? status.reason
      : asking && blind
        ? t("reasons.blind")
        : fallbackReason
          ? t(`reasons.${fallbackReason}`)
          : null;

  return (
    <div
      data-testid="approval-card"
      data-approval={status.kind}
      className={cn(
        "flex flex-col gap-3 rounded-panel border bg-[var(--el-surface-card)] p-4",
        BORDERS[status.kind]
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p
            data-testid="approval-summary"
            className={cn(
              "text-sm leading-snug font-semibold",
              showContent ? "text-[var(--el-ink)]" : "text-[var(--el-body)]"
            )}
          >
            {card?.title ?? summary ?? t("fallbackTitle")}
          </p>
          {card?.target ? (
            // 대상은 승인의 근거라 자르지 않는다. 길면 줄을 바꾼다.
            <p className="text-xs break-words text-[var(--el-muted)]">
              {card.target}
            </p>
          ) : null}
        </div>
        <Badge variant={badge.variant}>
          <Icon
            aria-hidden
            className={cn(
              status.kind === "running" &&
                "animate-spin motion-reduce:animate-none"
            )}
          />
          {t(`badges.${badge.label}`)}
        </Badge>
      </div>

      {showContent && card ? (
        <>
          {card.warning ? (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--el-warning-strong)]">
              <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {card.warning}
            </p>
          ) : null}
          {card.fields.length > 0 ? <Fields fields={card.fields} /> : null}
          {count > 0 ? <Items items={card.items} /> : null}
          {card.body ? (
            <Body
              label={card.body.label ?? t("bodyLabel")}
              text={card.body.text}
            />
          ) : null}
        </>
      ) : null}

      {reason ? (
        <p className="text-xs leading-relaxed text-[var(--el-body)]">
          {reason}
        </p>
      ) : null}
      {status.kind === "done" && status.url ? (
        <a
          href={status.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[var(--el-body-strong)] underline-offset-4 hover:underline"
        >
          {t("open")}
          <ExternalLink aria-hidden className="size-3" />
        </a>
      ) : null}

      {asking ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <p className="mr-auto text-[11px] leading-relaxed text-[var(--el-muted)]">
            {status.kind === "submitted"
              ? t("submittedHint")
              : t("waitingHint")}
          </p>
          {/* 누른 것만으로 뒤집지 않는다. 확정은 재개 스트림의 첫 프레임이 정한다. */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={status.kind === "submitted"}
              onClick={() => onApprove?.("REJECTED")}
            >
              {t("reject")}
            </Button>
            <Button
              size="sm"
              disabled={status.kind === "submitted" || blind}
              onClick={() => onApprove?.("APPROVED")}
            >
              {count > 1 ? t("approveCount", { count }) : t("approve")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Fields({ fields }: { fields: ApprovalCardField[] }) {
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
      {fields.map((field, index) => (
        <div key={`${field.label}-${index}`} className="contents">
          <dt className="min-w-14 text-xs leading-5 text-[var(--el-muted)]">
            {field.label}
          </dt>
          <dd className="min-w-0 break-words text-[var(--el-ink)]">
            <FieldValue field={field} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 값 하나. 명단 > 「전 → 후」 > 일반 값 순서로 읽는다. */
function FieldValue({ field }: { field: ApprovalCardField }) {
  const t = useTranslations("chat.approval");
  if (field.added.length + field.removed.length + field.kept.length > 0) {
    return (
      <span className="flex flex-wrap gap-1.5">
        {field.added.map((name) => (
          <Badge key={`+${name}`} variant="success">
            <Plus aria-label={t("added")} />
            {name}
          </Badge>
        ))}
        {field.removed.map((name) => (
          <Badge key={`-${name}`} variant="outline" className="line-through">
            <span className="sr-only">{t("removed")} </span>
            {name}
          </Badge>
        ))}
        {field.kept.map((name) => (
          <Badge key={`=${name}`} variant="secondary">
            {name}
          </Badge>
        ))}
      </span>
    );
  }
  if (field.before || field.after) {
    return (
      <>
        <span className="text-[var(--el-muted-soft)] line-through">
          {field.before ?? t("none")}
        </span>
        <span
          aria-label={t("from")}
          className="mx-1.5 text-[var(--el-muted-soft)]"
        >
          →
        </span>
        <span
          className={
            field.after
              ? "font-semibold text-[var(--el-ink)]"
              : "text-[var(--el-muted-soft)]"
          }
        >
          {field.after ?? t("none")}
        </span>
      </>
    );
  }
  return <>{field.value}</>;
}

function Items({ items }: { items: ApprovalCardData["items"] }) {
  const t = useTranslations("chat.approval");
  const rest = items.slice(ITEMS_SHOWN);
  return (
    <div className="overflow-hidden rounded-block border border-[var(--el-hairline)]">
      <ItemList items={items.slice(0, ITEMS_SHOWN)} start={1} />
      {rest.length > 0 ? (
        // 열림을 React state 로 들면 카드가 다시 그려질 때마다 접힌다.
        <details className="details-motion group border-t border-[var(--el-hairline)]">
          <summary className="flex cursor-pointer list-none items-center gap-1 bg-[var(--el-canvas-soft)] px-3 py-2 text-xs font-medium text-[var(--el-body-strong)] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">
              {t("showMore", { count: rest.length })}
            </span>
            <span className="hidden group-open:inline">{t("collapse")}</span>
            <ChevronDown
              aria-hidden
              className="size-3.5 transition-transform duration-200 ease-out group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <ItemList items={rest} start={ITEMS_SHOWN + 1} />
        </details>
      ) : null}
    </div>
  );
}

function ItemList({
  items,
  start,
}: {
  items: ApprovalCardData["items"];
  start: number;
}) {
  return (
    <ol className="divide-y divide-[var(--el-hairline)]">
      {items.map((item, index) => (
        <li key={index} className="flex flex-col gap-1 px-3 py-2.5">
          <div className="flex items-baseline gap-2 text-sm leading-snug font-medium text-[var(--el-ink)]">
            <span className="min-w-3.5 text-xs text-[var(--el-muted-soft)] tabular-nums">
              {start + index}
            </span>
            <span className="min-w-0 break-words">
              {item.title}
              {item.target ? (
                <span className="ml-2 text-xs font-normal text-[var(--el-muted)]">
                  {item.target}
                </span>
              ) : null}
            </span>
          </div>
          {item.fields.length > 0 ? (
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 pl-5.5 text-xs leading-relaxed text-[var(--el-body)]">
              {item.fields.map((field, at) => (
                <span key={`${field.label}-${at}`}>
                  <span className="mr-1.5 text-[var(--el-muted)]">
                    {field.label}
                  </span>
                  <FieldValue field={field} />
                </span>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** 긴 평문. 줄바꿈을 지키고, 길면 미리보기로 접어 둔다. */
function Body({ label, text }: { label: string; text: string }) {
  const t = useTranslations("chat.approval");
  const long = text.split("\n").length > BODY_LINES || text.length > BODY_CHARS;
  const content = (
    <>
      <span className="mb-1 block text-xs font-medium text-[var(--el-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "block text-sm leading-relaxed whitespace-pre-wrap text-[var(--el-body-strong)]",
          long && "line-clamp-5 group-open:line-clamp-none"
        )}
      >
        {text}
      </span>
    </>
  );
  const box =
    "rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]";
  if (!long) return <div className={cn(box, "px-3 py-2.5")}>{content}</div>;
  return (
    <details className={cn("group overflow-hidden", box)}>
      <summary className="block cursor-pointer list-none px-3 pt-2.5 [&::-webkit-details-marker]:hidden">
        {content}
        <span className="flex items-center gap-1 py-2 text-xs font-medium text-[var(--el-body-strong)]">
          <span className="group-open:hidden">{t("expand")}</span>
          <span className="hidden group-open:inline">{t("collapse")}</span>
          <ChevronDown
            aria-hidden
            className="size-3.5 transition-transform duration-200 ease-out group-open:rotate-180 motion-reduce:transition-none"
          />
        </span>
      </summary>
    </details>
  );
}
