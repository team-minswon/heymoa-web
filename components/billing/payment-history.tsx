"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PaymentStatusText } from "@/components/billing/subscription-management";
import { SETTINGS_LIST } from "@/components/settings/settings-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { billingEvents } from "@/lib/billing/analytics";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { cn } from "@/lib/utils";

/** 결제 내역 한 줄. 가운데 칸은 공간 내역에서는 결제자, 내 내역에서는 워크스페이스다. */
export type PaymentRow = {
  paymentId: string;
  completedAt: string | null;
  middle: string;
  amountKrw: number;
  status: Parameters<typeof PaymentStatusText>[0]["payment"]["status"];
  refundStatus: Parameters<
    typeof PaymentStatusText
  >[0]["payment"]["refundStatus"];
  /** 상세로 들어갈 수 있나 — 상세는 지금 그 공간의 ADMIN 만 연다. */
  openable: boolean;
  /** 나이스페이 매출전표 주소(APP-1600). 없으면 그 자리를 비운다. */
  receiptUrl?: string | null;
  /** 영수증 이벤트에 실을 공간. */
  workspaceId?: string;
};

/** 처음에 보이는 줄 수. 나머지는 「더 보기」로 펼친다(APP-1596). */
export const PAYMENT_PAGE = 12;

// 영수증 칸(56px)은 값이 없어도 비워 둬 행마다 열이 같다. 영수증 링크는 상세 버튼 안에 둘 수 없어(버튼 안 링크 금지)
// 행 위에 따로 얹는다 — 그 자리(오른쪽 끝에서 패딩 16 + 표시 16 + 간격 12)가 `RECEIPT_SLOT` 이다.
const ROW =
  "grid min-h-[52px] w-full grid-cols-[132px_minmax(0,1fr)_88px_112px_56px_16px] items-center gap-3 px-4 py-2.5 text-left text-sm";
const RECEIPT_SLOT = "absolute top-1/2 right-[44px] w-14 -translate-y-1/2";
const SKELETON_ROWS = 3;

/**
 * 결제 내역 표(날짜 | 결제자 또는 워크스페이스 | 금액 | 상태 | 상세 표시). 최근 12건만 보이고 더 있으면 「더 보기」가 나머지를 펼친다.
 * `rows` 가 null 이면 같은 행 구조에서 값만 막대로 바꾼 로딩 자리다(rule `error-loading`).
 */
export function PaymentList({
  rows,
  label,
  onOpen,
}: {
  rows: PaymentRow[] | null;
  label: string;
  onOpen?: (paymentId: string) => void;
}) {
  const t = useTranslations("billing.history");
  const format = useBillingFormat();
  const [expanded, setExpanded] = useState(false);
  const shown = rows && !expanded ? rows.slice(0, PAYMENT_PAGE) : rows;
  const hidden = rows ? rows.length - (shown?.length ?? 0) : 0;
  return (
    <div className={SETTINGS_LIST}>
      <ul aria-label={label} className="divide-y divide-[var(--el-hairline)]">
        {shown
          ? shown.map((payment) => {
              const date = payment.completedAt
                ? format.date(payment.completedAt)
                : t("noDate");
              const cells = (
                <>
                  <span className="whitespace-nowrap text-[var(--el-ink)]">
                    {date}
                  </span>
                  <span className="truncate text-[var(--el-muted)]">
                    {payment.middle}
                  </span>
                  <span className="text-right whitespace-nowrap text-[var(--el-ink)] tabular-nums">
                    {format.money(payment.amountKrw)}
                  </span>
                  <PaymentStatusText payment={payment} />
                  <span aria-hidden />
                </>
              );
              return (
                // 영수증 위에 있어도 행 전체가 같이 칠해지게 행(group)의 hover 로 칠한다.
                <li key={payment.paymentId} className="group relative">
                  {payment.openable && onOpen ? (
                    <button
                      type="button"
                      onClick={() => onOpen(payment.paymentId)}
                      className={cn(
                        ROW,
                        "group-hover:bg-[var(--el-canvas-soft)]"
                      )}
                    >
                      {cells}
                      <span className="sr-only">{t("detail")}</span>
                      <ChevronRight
                        className="size-4 text-[var(--el-muted)]"
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <div className={ROW}>{cells}</div>
                  )}
                  <ReceiptLink
                    url={payment.receiptUrl}
                    date={date}
                    workspaceId={payment.workspaceId}
                    className={RECEIPT_SLOT}
                  />
                </li>
              );
            })
          : Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li key={index} className={ROW}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="ml-auto h-4 w-14" />
                <Skeleton className="h-4 w-12" />
              </li>
            ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-h-[44px] w-full items-center justify-center text-sm text-[var(--el-muted)] hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)]"
        >
          {t("more", { count: hidden })}
        </button>
      ) : null}
    </div>
  );
}

/** 결제 영수증(나이스페이 매출전표, APP-1600) 새 창 링크. `https://` 주소만 그린다 — 서버 값이 아니면 링크로 내보내지 않는다. */
export function ReceiptLink({
  url,
  date,
  workspaceId,
  className,
}: {
  url: string | null | undefined;
  /** 접근성 이름에 넣는 결제 날짜(화면에 보이는 꼴 그대로). */
  date: string;
  workspaceId?: string;
  className?: string;
}) {
  const t = useTranslations("billing.history");
  if (!url?.startsWith("https://")) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("receiptLabel", { date })}
      onClick={() => billingEvents.receiptClicked(workspaceId)}
      className={cn(
        "text-sm whitespace-nowrap text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]",
        className
      )}
    >
      {t("receipt")}
    </a>
  );
}
