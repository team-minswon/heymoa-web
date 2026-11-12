"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  BillingNotice,
  TestPaymentNotice,
} from "@/components/billing/billing-parts";
import { CardFields } from "@/components/billing/card-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  submitBillingCard,
  useGetMyBillingSetup,
} from "@/lib/api/generated/billing/billing";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { errorMessageOf } from "@/lib/api/error-message";
import { ApiError, isAuthError, REQUEST_TIMEOUT_MS } from "@/lib/api/fetcher";
import { okData } from "@/lib/api/ok-data";
import {
  cardErrors,
  cardRequestOf,
  EMPTY_CARD,
  type CardForm,
} from "@/lib/billing/card-input";
import {
  goToSetupResult,
  replaceWithSetupResult,
} from "@/lib/billing/navigate";
import { planName } from "@/lib/billing/plan-name";
import { setupViewOf } from "@/lib/billing/setup-view";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { webMessage } from "@/lib/i18n/web-message";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

/**
 * `/billing/setups/{setupId}/card` — 카드 정보 입력(APP-1600). 주문서에서 두 동의를 받고 등록을 연 뒤 문서를 새로 열어 온다.
 * 이 면(`app/(card-entry)`)에는 분석 스크립트가 없고 `proxy.ts` 가 CSP 를 건다. 카드 정보는 입력 칸의 상태에만 산다.
 *
 * 카드를 기다리는 등록(CARD_AUTH_REQUIRED)만 받는다. 그 등록은 서버가 동의 버전을 받고 연 것이라 여기서 동의를 다시 받지
 * 않는다. 다른 상태의 등록이면 결과 화면으로 바꿔 간다 — 거기서 그 상태를 알리고 주문서로 다시 시작할 길을 준다.
 */
export function BillingCardEntryPage({ setupId }: { setupId: string }) {
  const t = useTranslations("billing.cardEntry");
  const tSetup = useTranslations("billing.setup");
  const format = useBillingFormat();
  const query = useGetMyBillingSetup(setupId);
  const setup = okData(query.data);
  const awaitingCard = setup ? setupViewOf(setup) === "cardAuthRequired" : null;
  const workspaceId = setup?.workspaceId ?? null;
  const workspace = okData(
    useGetWorkspace(workspaceId ?? "", {
      query: { enabled: Boolean(workspaceId) },
    }).data
  );

  useEffect(() => {
    if (awaitingCard === false) replaceWithSetupResult(setupId);
  }, [awaitingCard, setupId]);

  const replace = setup?.purpose === "REPLACE";
  const summary =
    setup && workspace
      ? replace
        ? t("summaryReplace", { workspace: workspace.name })
        : setup.planCode && setup.amountKrw != null
          ? t("summary", {
              workspace: workspace.name,
              plan: planName(setup.planCode),
              amount: format.money(setup.amountKrw),
            })
          : workspace.name
      : null;

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      viewportClassName="overflow-x-hidden!"
    >
      <div className="mx-auto w-full max-w-[640px] px-5 pb-16 pt-10 sm:pt-16">
        <header className="mb-8">
          <h2 className="text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
            {t("title")}
          </h2>
          {summary ? (
            <p className="mt-2 truncate text-sm text-[var(--el-muted)]">
              {summary}
            </p>
          ) : (
            <Skeleton className="mt-2 h-5 w-64" />
          )}
        </header>
        {query.isPending || awaitingCard === false ? (
          <Skeleton aria-label={t("loading")} className="h-80 w-full" />
        ) : !setup || !workspaceId ? (
          query.error instanceof ApiError && query.error.status === 404 ? (
            <SetupNotFound />
          ) : (
            <InlineRetry
              onRetry={() => void query.refetch()}
              label={tSetup("loadFailed")}
            />
          )
        ) : (
          <CardEntryForm
            setupId={setupId}
            workspaceId={workspaceId}
            replace={replace}
            testPaymentNotice={setup.testPaymentNotice ?? undefined}
          />
        )}
      </div>
    </ScrollArea>
  );
}

function SetupNotFound() {
  const t = useTranslations("billing.setup");
  return (
    <BillingNotice tone="warn" title={t("notFound.title")}>
      {t("notFound.body")}
    </BillingNotice>
  );
}

function CardEntryForm({
  setupId,
  workspaceId,
  replace,
  testPaymentNotice,
}: {
  setupId: string;
  workspaceId: string;
  replace: boolean;
  testPaymentNotice: Parameters<typeof TestPaymentNotice>[0]["notice"];
}) {
  const t = useTranslations("billing.cardEntry");
  // 카드 정보는 이 상태에만 산다 — 제출이 끝나면 비우고, 결과 화면은 문서를 새로 연다.
  const [card, setCard] = useState<CardForm>(EMPTY_CARD);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const errors = cardErrors(card, new Date());
  const ready = Object.keys(errors).length === 0;

  const submit = async () => {
    if (submitting || !ready) return;
    setSubmitting(true);
    setNotice(null);
    let moving = false;
    try {
      // 생성 함수를 훅(`useMutation`) 없이 부른다 — 뮤테이션 캐시가 변수(카드 정보)를 들고 있고 전역
      // `MutationCache.onSuccess` 가 변수를 분석 이벤트(`trackMutation`)에 넘기기 때문이다. 그래서 실패 문구도 여기서 낸다.
      await submitBillingCard(workspaceId, setupId, cardRequestOf(card), {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      setCard(EMPTY_CARD);
      moving = true;
      goToSetupResult(setupId);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null;
      if (status === 400) setNotice(t("cardRejected"));
      else if (status === 409) {
        // 등록이 더는 카드를 받지 않는다(이미 낸 카드를 처리 중이거나 닫힘) — 결과 화면이 그 상태를 알린다.
        moving = true;
        goToSetupResult(setupId);
      } else if (error instanceof ApiError && status === 429) {
        // 시도 제한(APP-1600). 봉투가 없으면 fetcher 가 `HTTP_429` 로 채운다 — 그때만 이 화면의 문구를 쓴다.
        setNotice(
          error.error.code === "HTTP_429"
            ? t("tooManyAttempts")
            : error.error.message
        );
      } else if (!isAuthError(error))
        toast.error(errorMessageOf(error, webMessage("requestFailed")));
    } finally {
      if (!moving) setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <CardFields
        value={card}
        onChange={setCard}
        errors={errors}
        disabled={submitting}
      />
      {replace ? null : <TestPaymentNotice notice={testPaymentNotice} />}
      {notice ? <BillingNotice tone="warn">{notice}</BillingNotice> : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          className="h-10 px-4"
          disabled={!ready}
          aria-describedby={ready ? undefined : "billing-card-hint"}
          loading={submitting}
          onClick={submit}
        >
          {replace ? t("submitReplace") : t("submit")}
          <ArrowRight aria-hidden />
        </Button>
        {/* 일반 링크로 문서를 새로 연다 — 분석이 실린 설정 창 문서로 돌아가며 카드 정보를 메모리에 남기지 않는다. */}
        <a
          href={`/w/${workspaceId}?settings=${replace ? "payment" : "billing"}`}
          className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}
        >
          {t("back")}
        </a>
        <span id="billing-card-hint" className="sr-only">
          {t("fillFirst")}
        </span>
      </div>
    </div>
  );
}
