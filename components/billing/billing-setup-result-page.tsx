"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import {
  BillingNotice,
  FeedbackLink,
  TestPaymentNotice,
} from "@/components/billing/billing-parts";
import { SETTINGS_LIST } from "@/components/settings/settings-layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button, LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetMyBillingSetupQueryKey,
  useCancelBillingSetup,
  useGetMyBillingSetup,
  useGetWorkspaceBilling,
} from "@/lib/api/generated/billing/billing";
import type { BillingSetupStatusResponseData } from "@/lib/api/generated/models";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import type { BillingSetupScreen } from "@/lib/analytics/track";
import { ApiError } from "@/lib/api/fetcher";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import {
  cardChangeResultOfView,
  isPollingView,
  NOT_PROCESSED_CODE,
  resultOfView,
  setupViewOf,
  type SetupView,
} from "@/lib/billing/setup-view";
import { planName } from "@/lib/billing/plan-name";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { nextPollDelay, usePollWindow } from "@/lib/billing/use-poll-window";
import { cn } from "@/lib/utils";

/**
 * 결과 조회 한 번의 시한. 응답이 멈추면 스켈레톤에 머물지 않고 「불러오지 못했습니다」와 다시 확인을 보인다.
 * 화면과 결과가 같은 조회 키를 쓰므로 둘 다 같은 시한을 준다 — 어느 쪽이 읽어도 같다.
 */
const SETUP_REQUEST = { timeoutMs: 10_000 };

type SetupAction = "recheck" | "retry" | "to_workspace";

/**
 * `/billing/setups/{setupId}` — 카드 등록 결과. 워크스페이스 셸 밖이다. 주문서·카드 변경에서 카드를 낸 뒤 여기로 온다(APP-1600).
 *
 * 서버가 일하는 동안 이 화면은 **표시용으로** 다시 읽을 뿐이다 — 화면을 닫거나 읽기를 멈춰도 서버 작업은 계속된다.
 * 주소에는 등록 번호만 있고, 이 화면은 카드 정보를 받지도 읽지도 않는다.
 */
export function BillingSetupResultPage({ setupId }: { setupId: string }) {
  const t = useTranslations("billing.setup");
  // 첫 구매는 카드 등록 뒤 결제까지 가므로 「결제 결과」다. 아래 결과와 같은 조회 키라 요청은 하나다.
  const setupQuery = useGetMyBillingSetup(setupId, { request: SETUP_REQUEST });
  const purchase = okData(setupQuery.data)?.purpose === "PURCHASE";
  return (
    <ScrollArea
      className="min-h-0 flex-1"
      viewportClassName="overflow-x-hidden!"
    >
      {/* 한 가지 결과만 읽는 화면이라 좁은 단 하나다. */}
      <div className="mx-auto w-full max-w-[640px] px-5 pb-16 pt-10 sm:pt-16">
        <header className="mb-8">
          {!setupQuery.isPending ? (
            <>
              <h2 className="text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
                {t(purchase ? "purchaseTitle" : "title")}
              </h2>
              <p className="mt-2 text-sm text-[var(--el-muted)]">
                {t(purchase ? "purchaseDescription" : "description")}
              </p>
            </>
          ) : (
            <>
              <Skeleton className="h-9 w-48" />
              <Skeleton className="mt-2 h-5 w-64" />
            </>
          )}
        </header>
        <div className="flex flex-col gap-4">
          <SetupResult setupId={setupId} />
        </div>
      </div>
    </ScrollArea>
  );
}

function SetupResult({ setupId }: { setupId: string }) {
  const t = useTranslations("billing.setup");
  const queryClient = useQueryClient();
  const poll = usePollWindow();
  const query = useGetMyBillingSetup(setupId, {
    request: SETUP_REQUEST,
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

  const cancel = useCancelBillingSetup();
  const refreshSetup = () =>
    queryClient.invalidateQueries({
      queryKey: getGetMyBillingSetupQueryKey(setupId),
    });

  // 상태가 바뀌면 그 공간의 결제 조회만 다시 읽게 한다.
  useEffect(() => {
    if (view && workspaceId)
      void invalidateWorkspaceBilling(queryClient, workspaceId);
  }, [view, workspaceId, queryClient]);

  // 최종 상태가 처음 보일 때 한 번씩만 분석 이벤트를 낸다(같은 결과를 폴링마다 다시 내지 않는다).
  // 카드 변경(REPLACE)은 구매 퍼널에 섞지 않고 카드 변경 결과로 따로 낸다.
  const reported = useRef(new Set<string>());
  const purchase = setup?.purpose !== "REPLACE";
  useEffect(() => {
    if (!view) return;
    const workspace = workspaceId ? { workspace_id: workspaceId } : {};
    const once = (result: string | null) => {
      if (!result || reported.current.has(result)) return false;
      reported.current.add(result);
      return true;
    };
    if (purchase) {
      const result = resultOfView(view);
      if (result && once(result))
        billingEvents.cardSetupResulted({
          ...workspace,
          ...(provider ? { provider } : {}),
          result,
        });
    } else {
      const result = cardChangeResultOfView(view);
      if (result && once(result))
        billingEvents.cardChangeResulted({ ...workspace, result });
    }
  }, [view, workspaceId, provider, purchase]);

  // 버튼을 누른 때의 화면 — 결과 값이 있으면 그것, 없으면 화면 상태 이름.
  const screen: BillingSetupScreen = view
    ? (resultOfView(view) ?? view)
    : "loadFailed";
  const clicked = (action: SetupAction) =>
    billingEvents.setupResultActionClicked({ action, result: screen });

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
    // 첫 조회의 실패·시한 초과는 결제 실패가 아니다 — 거절 화면으로 보이지 않게 따로 알린다.
    return notFound ? (
      <BillingNotice tone="warn" title={t("notFound.title")}>
        {t("notFound.body")}
      </BillingNotice>
    ) : (
      <BillingNotice title={t("statusFailed.title")}>
        <p>{t("statusFailed.body")}</p>
        <Button
          variant="outline"
          className="mt-3"
          loading={query.isFetching}
          onClick={() => {
            clicked("recheck");
            poll.restart();
            void query.refetch();
          }}
        >
          {t("recheck")}
        </Button>
      </BillingNotice>
    );
  }

  const stale = poll.expired && isPollingView(view);
  return (
    <div className="flex flex-col gap-4">
      <ViewBody
        view={view}
        setup={setup}
        workspaceId={workspaceId}
        busy={cancel.isPending}
        onAction={clicked}
        onCancel={async () => {
          if (!workspaceId) return;
          const done = await cancel
            .mutateAsync({ workspaceId, setupId })
            .then(() => true)
            .catch(() => false);
          if (done) await refreshSetup();
        }}
      />
      <TestPaymentNotice notice={setup.testPaymentNotice ?? undefined} />
      {/* 메뉴 없는 화면이라 완료 전 상태(확인 중·거절·결과 지연)에서도 나갈 길을 둔다. */}
      {workspaceId && view !== "completed" ? (
        <LinkButton
          variant="outline"
          href={`/w/${workspaceId}?settings=billing`}
          className="self-start"
          onClick={() => clicked("to_workspace")}
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
              clicked("recheck");
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
  onAction,
  onCancel,
}: {
  view: SetupView;
  setup: SetupData;
  workspaceId: string | null;
  busy: boolean;
  onAction: (action: SetupAction) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("billing.setup");
  // 카드 변경은 카드만 바꾸고 청구하지 않는다 — 결과 문구·다시 시작할 곳을 구매와 섞지 않는다.
  const replace = setup.purpose === "REPLACE";
  // 종료 예정인 구독에 카드만 등록했으면 다음 결제가 없다 — 재개해야 이 카드로 결제된다(APP-1588).
  const billingQuery = useGetWorkspaceBilling(workspaceId ?? "", {
    query: { enabled: replace && Boolean(workspaceId) },
  });
  const ending = okData(billingQuery.data)?.cancelAtPeriodEnd === true;
  // 첫 구독은 전용 결제 페이지에서, 카드 변경은 결제 관리 탭에서 다시 시작한다(APP-1600).
  const checkout = workspaceId
    ? replace
      ? `/w/${workspaceId}?settings=payment`
      : `/billing/checkout/${workspaceId}`
    : null;
  // 문의 창에 실을 번호 — 승인 시도(= 결제 번호)가 있으면 그것, 없으면 등록 번호.
  const attemptId = (setup.latestAttempt ?? setup.originAttempt)?.attemptId;
  const supportBody = (key: Parameters<typeof t.rich>[0]) =>
    t.rich(key, {
      link: (chunks) => (
        <FeedbackLink
          reference={
            attemptId
              ? { type: "payment", id: attemptId }
              : { type: "setup", id: setup.setupId }
          }
        >
          {chunks}
        </FeedbackLink>
      ),
    });
  const card = (
    title: string,
    body?: React.ReactNode,
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
    <LinkButton href={checkout} onClick={() => onAction("retry")}>
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
    case "cardProcessing":
      return card(t("cardProcessing.title"), t("cardProcessing.body"));
    case "cardActionRequired":
      return card(
        t(
          replace
            ? "replace.cardActionRequired.title"
            : "cardActionRequired.title"
        ),
        supportBody(
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
        supportBody("paymentUnknown.body"),
        undefined,
        "warn"
      );
    case "declined": {
      // 거절된 카드는 서버가 지운다 — 같은 카드로 다시 결제하지 않고 카드 등록부터 새로 시작한다.
      const code =
        setup.latestAttempt?.errorCode ?? setup.originAttempt?.errorCode;
      const reason = code === NOT_PROCESSED_CODE ? "notProcessed" : "declined";
      return (
        <BillingNotice tone="warn" title={t(`${reason}.title`)}>
          <p>{t(`${reason}.body`)}</p>
          {code ? (
            <p className="mt-2 text-xs text-[var(--el-muted)]">
              {t("declined.code", { code })}
            </p>
          ) : null}
          {restartLink && setup.allowedActions.includes("START_PURCHASE") ? (
            <div className="mt-3">{restartLink}</div>
          ) : null}
        </BillingNotice>
      );
    }
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
        supportBody("accessActionRequired.body"),
        undefined,
        "warn"
      );
    case "completed":
      if (replace && workspaceId && billingQuery.isPending)
        return <Skeleton aria-label={t("loading")} className="h-28 w-full" />;
      return replace ? (
        card(
          t(
            ending ? "replace.completedEnding.title" : "replace.completed.title"
          ),
          t(ending ? "replace.completedEnding.body" : "replace.completed.body"),
          workspaceId ? (
            <LinkButton
              href={`/w/${workspaceId}?settings=payment`}
              onClick={() => onAction("to_workspace")}
            >
              {t("replace.completed.goPlans")}
            </LinkButton>
          ) : null
        )
      ) : (
        <CompletedBody
          setup={setup}
          workspaceId={workspaceId}
          onAction={onAction}
        />
      );
    case "accessLost":
      return card(
        t("accessLost.title"),
        t("accessLost.body"),
        undefined,
        "warn"
      );
    case "issueUnknown":
      return card(
        t("issueUnknown.title"),
        t("issueUnknown.body"),
        restartLink,
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

function CompletedBody({
  setup,
  workspaceId,
  onAction,
}: {
  setup: SetupData;
  workspaceId: string | null;
  onAction: (action: SetupAction) => void;
}) {
  const t = useTranslations("billing.setup");
  const format = useBillingFormat();
  const workspace = okData(
    useGetWorkspace(workspaceId ?? "", {
      query: { enabled: Boolean(workspaceId) },
    }).data
  );
  return (
    <div className="rounded-panel border border-[var(--el-hairline)] bg-white p-6">
      <span className="flex size-10 items-center justify-center rounded-full bg-[var(--el-ink)] text-white">
        <Check className="size-5" aria-hidden />
      </span>
      <p
        role="status"
        className="mt-5 text-2xl leading-8 font-light tracking-[-0.02em] text-[var(--el-ink)]"
      >
        {t("completed.title")}
      </p>
      <dl className={cn(SETTINGS_LIST, "mt-6 text-sm")}>
        {workspace ? (
          <SummaryRow label={t("completed.workspace")} value={workspace.name} />
        ) : null}
        {setup.planCode ? (
          <SummaryRow
            label={t("completed.plan")}
            value={planName(setup.planCode)}
          />
        ) : null}
        {setup.amountKrw != null ? (
          <SummaryRow
            label={t("completed.amount")}
            value={format.money(setup.amountKrw)}
          />
        ) : null}
        {setup.paidPeriod ? (
          <>
            <SummaryRow
              label={t("completed.period")}
              value={format.period(setup.paidPeriod)}
            />
            <SummaryRow
              label={t("completed.nextCharge")}
              value={format.date(setup.paidPeriod.end)}
            />
          </>
        ) : null}
      </dl>
      {workspaceId ? (
        <LinkButton
          href={`/w/${workspaceId}`}
          className="mt-6 h-10 px-4"
          onClick={() => onAction("to_workspace")}
        >
          {t("completed.goWorkspace")}
          <ArrowRight aria-hidden />
        </LinkButton>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-[var(--el-muted)]">{label}</dt>
      <dd className="text-right text-[var(--el-ink)]">{value}</dd>
    </div>
  );
}
