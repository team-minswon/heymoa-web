"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import {
  BillingNotice,
  RetryPaymentButton,
  TestPaymentNotice,
  canRetryPayment,
} from "@/components/billing/billing-parts";
import { BillingScreen } from "@/components/billing/billing-screen";
import { Button, LinkButton } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetMyBillingSetupQueryKey,
  useCancelBillingSetup,
  useCompleteBillingSetup,
  useGetMyBillingSetup,
  useGetWorkspaceBilling,
} from "@/lib/api/generated/billing/billing";
import type { BillingSetupStatusResponseData } from "@/lib/api/generated/models";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { ApiError } from "@/lib/api/fetcher";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import {
  isPollingView,
  resultOfView,
  setupViewOf,
  type SetupView,
} from "@/lib/billing/setup-view";
import { planName } from "@/lib/billing/plan-name";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { nextPollDelay, usePollWindow } from "@/lib/billing/use-poll-window";

/**
 * `/billing/setups/{setupId}` — 카드 등록 결과. 워크스페이스 셸 밖이다(PG 복귀 뒤 깨끗한 주소).
 *
 * 서버가 일하는 동안 이 화면은 **표시용으로** 다시 읽을 뿐이다 — 화면을 닫거나 읽기를 멈춰도 서버 작업은 계속된다.
 * 주소에는 authKey·state 가 없고, 이 화면도 그 값을 읽거나 저장하지 않는다.
 */
export function BillingSetupResultPage({ setupId }: { setupId: string }) {
  const t = useTranslations("billing.setup");
  return (
    <BillingScreen title={t("title")} description={t("description")}>
      <SetupResult setupId={setupId} />
    </BillingScreen>
  );
}

function SetupResult({ setupId }: { setupId: string }) {
  const t = useTranslations("billing.setup");
  const queryClient = useQueryClient();
  const poll = usePollWindow();
  const query = useGetMyBillingSetup(setupId, {
    query: {
      staleTime: 0,
      refetchInterval: (q) => {
        const data = okData(q.state.data);
        if (poll.expired || !data || !isPollingView(setupViewOf(data)))
          return false;
        return nextPollDelay(data.pollAfterSeconds, q.state.dataUpdateCount);
      },
    },
  });
  const setup = okData(query.data);
  const view = setup ? setupViewOf(setup) : null;
  const workspaceId = setup?.workspaceId ?? null;
  const provider = setup?.provider ?? null;

  const complete = useCompleteBillingSetup();
  const cancel = useCancelBillingSetup();
  const refreshSetup = () =>
    queryClient.invalidateQueries({
      queryKey: getGetMyBillingSetupQueryKey(setupId),
    });

  const runComplete = async () => {
    if (!workspaceId) return;
    const started = await complete
      .mutateAsync({ workspaceId, setupId })
      .then(() => true)
      .catch(() => false);
    if (started) {
      poll.restart();
      await refreshSetup();
    }
  };
  // 인증이 끝난 등록은 화면에 들어오면 한 번 자동으로 완료를 맡긴다. 중복 호출은 서버가 한 번만 처리한다.
  const autoCompleted = useRef(false);
  useEffect(() => {
    if (view === "authCaptured" && workspaceId && !autoCompleted.current) {
      autoCompleted.current = true;
      void runComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 상태가 처음 authCaptured 로 보일 때 한 번만
  }, [view, workspaceId]);

  // 상태가 바뀌면 그 공간의 결제 조회만 다시 읽게 한다.
  useEffect(() => {
    if (view && workspaceId)
      void invalidateWorkspaceBilling(queryClient, workspaceId);
  }, [view, workspaceId, queryClient]);

  // 최종 상태가 처음 보일 때 한 번씩만 분석 이벤트를 낸다(같은 결과를 폴링마다 다시 내지 않는다).
  // 카드 변경(REPLACE)은 구매 퍼널이 아니라 세지 않는다.
  const reported = useRef(new Set<string>());
  const purchase = setup?.purpose !== "REPLACE";
  useEffect(() => {
    const result = view && purchase ? resultOfView(view) : null;
    if (!result || reported.current.has(result)) return;
    reported.current.add(result);
    billingEvents.cardSetupResulted({
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      ...(provider ? { provider } : {}),
      result,
    });
  }, [view, workspaceId, provider, purchase]);

  // 창으로 돌아오면 자동 읽기가 멈춘 뒤에도 한 번 읽는다.
  useEffect(() => {
    const onFocus = () => {
      if (poll.expired && view && isPollingView(view)) void query.refetch();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [poll.expired, view, query]);

  if (query.isPending) {
    return <Skeleton aria-label={t("loading")} className="h-48 w-full" />;
  }
  if (!setup || !view) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    return notFound ? (
      <BillingNotice tone="warn" title={t("notFound.title")}>
        {t("notFound.body")}
      </BillingNotice>
    ) : (
      <InlineRetry
        onRetry={() => void query.refetch()}
        label={t("loadFailed")}
      />
    );
  }

  const stale = poll.expired && isPollingView(view);
  return (
    <div className="flex flex-col gap-4">
      <ViewBody
        view={view}
        setup={setup}
        workspaceId={workspaceId}
        busy={complete.isPending || cancel.isPending}
        onComplete={runComplete}
        onCancel={async () => {
          if (!workspaceId) return;
          const done = await cancel
            .mutateAsync({ workspaceId, setupId })
            .then(() => true)
            .catch(() => false);
          if (done) await refreshSetup();
        }}
        onRetried={() => {
          reported.current.clear();
          poll.restart();
          void refreshSetup();
        }}
      />
      <TestPaymentNotice notice={setup.testPaymentNotice ?? undefined} />
      {/* 메뉴 없는 화면이라 완료 전 상태(확인 중·거절·결과 지연)에서도 나갈 길을 둔다. */}
      {workspaceId && view !== "completed" ? (
        <LinkButton
          variant="outline"
          href={`/w/${workspaceId}/billing`}
          className="self-start"
        >
          {t("backToWorkspace")}
        </LinkButton>
      ) : null}
      {stale ? (
        <BillingNotice>
          <p>{t("stale")}</p>
          <Button
            variant="outline"
            className="mt-3"
            loading={query.isFetching}
            onClick={() => {
              poll.restart();
              void query.refetch();
            }}
          >
            {t("recheck")}
          </Button>
        </BillingNotice>
      ) : null}
    </div>
  );
}

type SetupData = BillingSetupStatusResponseData;

function ViewBody({
  view,
  setup,
  workspaceId,
  busy,
  onComplete,
  onCancel,
  onRetried,
}: {
  view: SetupView;
  setup: SetupData;
  workspaceId: string | null;
  busy: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onRetried: () => void;
}) {
  const t = useTranslations("billing.setup");
  // 카드 변경은 카드만 바꾸고 청구하지 않는다 — 결과 문구·다시 시작할 곳을 구매와 섞지 않는다.
  const replace = setup.purpose === "REPLACE";
  const checkout = workspaceId
    ? `/w/${workspaceId}/billing/${replace ? "card" : "checkout"}`
    : null;
  const card = (
    title: string,
    body?: string,
    extra?: React.ReactNode,
    tone?: "warn"
  ) => (
    <BillingNotice tone={tone} title={title}>
      {body ? <p>{body}</p> : null}
      {extra ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">{extra}</div>
      ) : null}
    </BillingNotice>
  );
  const restartLink = checkout ? (
    <LinkButton href={checkout}>
      {replace ? t("replace.restart") : t("restart")}
    </LinkButton>
  ) : null;

  switch (view) {
    case "cardAuthRequired":
      return card(
        t("cardAuthRequired.title"),
        t("cardAuthRequired.body"),
        setup.allowedActions.includes("CANCEL_SETUP") ? (
          <Button onClick={onCancel} loading={busy}>
            {t("cancelRestart")}
          </Button>
        ) : (
          restartLink
        )
      );
    case "authCaptured":
      return card(
        t("authCaptured.title"),
        t("authCaptured.body"),
        <>
          <Button onClick={onComplete} loading={busy}>
            {t("continue")}
          </Button>
          {setup.allowedActions.includes("CANCEL_SETUP") ? (
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              {t("cancel")}
            </Button>
          ) : null}
        </>
      );
    case "cardProcessing":
      return card(t("cardProcessing.title"), t("cardProcessing.body"));
    case "cardUnknown":
      return card(t("cardUnknown.title"), t("cardUnknown.body"));
    case "cardActionRequired":
      return card(
        t(
          replace
            ? "replace.cardActionRequired.title"
            : "cardActionRequired.title"
        ),
        t(
          replace
            ? "replace.cardActionRequired.body"
            : "cardActionRequired.body"
        ),
        restartLink,
        "warn"
      );
    case "paymentProcessing":
      return card(t("paymentProcessing.title"), t("paymentProcessing.body"));
    case "paymentUnknown":
      // 새 결제 버튼을 두지 않는다 — 결과가 나오기 전에 다시 결제하면 이중 청구가 될 수 있다.
      return card(
        t("paymentUnknown.title"),
        t("paymentUnknown.body"),
        undefined,
        "warn"
      );
    case "declined":
      return (
        <DeclinedBody
          setup={setup}
          workspaceId={workspaceId}
          onRetried={onRetried}
        />
      );
    case "accessProcessing":
      return card(t("accessProcessing.title"), t("accessProcessing.body"));
    case "refundProcessing":
      return card(
        t("refundProcessing.title"),
        t("refundProcessing.body"),
        undefined,
        "warn"
      );
    case "refunded":
      return card(t("refunded.title"), t("refunded.body"), restartLink);
    case "accessActionRequired":
      return card(
        t("accessActionRequired.title"),
        t("accessActionRequired.body"),
        undefined,
        "warn"
      );
    case "completed":
      return replace ? (
        card(
          t("replace.completed.title"),
          t("replace.completed.body"),
          workspaceId ? (
            <LinkButton href={`/w/${workspaceId}/billing`}>
              {t("replace.completed.goPlans")}
            </LinkButton>
          ) : null
        )
      ) : (
        <CompletedBody setup={setup} workspaceId={workspaceId} />
      );
    case "accessLost":
      return card(
        t("accessLost.title"),
        t("accessLost.body"),
        undefined,
        "warn"
      );
    case "closed":
      return card(
        t(replace ? "replace.closed.title" : "closed.title"),
        t(replace ? "replace.closed.body" : "closed.body"),
        restartLink
      );
  }
}

function DeclinedBody({
  setup,
  workspaceId,
  onRetried,
}: {
  setup: SetupData;
  workspaceId: string | null;
  onRetried: () => void;
}) {
  const t = useTranslations("billing.setup");
  const retryAllowed = setup.allowedActions.includes("RETRY_PAYMENT");
  // 다시 결제에 필요한 버전·시도 id 는 공간 결제 조회(ADMIN)에 있다.
  const billing = okData(
    useGetWorkspaceBilling(workspaceId ?? "", {
      query: { enabled: Boolean(workspaceId) && retryAllowed, staleTime: 0 },
    }).data
  );
  const detail = billing?.detail ?? null;
  const code = setup.latestAttempt?.errorCode ?? setup.originAttempt?.errorCode;
  return (
    <BillingNotice tone="warn" title={t("declined.title")}>
      <p>{t("declined.body")}</p>
      {code ? (
        <p className="mt-1 text-xs">{t("declined.code", { code })}</p>
      ) : null}
      {retryAllowed &&
      workspaceId &&
      detail &&
      canRetryPayment(detail) &&
      setup.amountKrw != null ? (
        <div className="mt-3">
          <RetryPaymentButton
            workspaceId={workspaceId}
            detail={detail}
            amountKrw={setup.amountKrw}
            onRetried={onRetried}
          />
        </div>
      ) : null}
    </BillingNotice>
  );
}

function CompletedBody({
  setup,
  workspaceId,
}: {
  setup: SetupData;
  workspaceId: string | null;
}) {
  const t = useTranslations("billing.setup");
  const format = useBillingFormat();
  const workspace = okData(
    useGetWorkspace(workspaceId ?? "", {
      query: { enabled: Boolean(workspaceId) },
    }).data
  );
  return (
    <BillingNotice title={t("completed.title")}>
      <dl className="mt-2 grid gap-1.5">
        {workspace ? (
          <Line label={t("completed.workspace")} value={workspace.name} />
        ) : null}
        {setup.planCode ? (
          <Line label={t("completed.plan")} value={planName(setup.planCode)} />
        ) : null}
        {setup.amountKrw != null ? (
          <Line
            label={t("completed.amount")}
            value={format.money(setup.amountKrw)}
          />
        ) : null}
        {setup.paidPeriod ? (
          <>
            <Line
              label={t("completed.period")}
              value={format.period(setup.paidPeriod)}
            />
            <Line
              label={t("completed.nextCharge")}
              value={format.date(setup.paidPeriod.end)}
            />
          </>
        ) : null}
      </dl>
      {workspaceId ? (
        <LinkButton href={`/w/${workspaceId}`} className="mt-4">
          {t("completed.goWorkspace")}
        </LinkButton>
      ) : null}
    </BillingNotice>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-right text-[var(--el-ink)]">{value}</dd>
    </div>
  );
}
