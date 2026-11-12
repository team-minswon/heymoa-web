"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  BillingNotice,
  TestPaymentNotice,
} from "@/components/billing/billing-parts";
import { CardFields } from "@/components/billing/card-fields";
import { SitePageLink } from "@/components/heymoa/site-page-link";
import { SETTINGS_LIST } from "@/components/settings/settings-layout";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  submitBillingCard,
  useCancelBillingSetup,
  useCreateBillingSetup,
  getMyBillingSetup,
} from "@/lib/api/generated/billing/billing";
import { useGetWorkspaceSuspense } from "@/lib/api/generated/workspaces/workspaces";
import { errorCodeOf } from "@/lib/api/error-message";
import { ApiError, isAuthError, REQUEST_TIMEOUT_MS } from "@/lib/api/fetcher";
import { okData } from "@/lib/api/ok-data";
import {
  cardErrors,
  cardRequestOf,
  EMPTY_CARD,
  type CardForm,
} from "@/lib/billing/card-input";
import { nextMonthlyChargeAt } from "@/lib/billing/next-charge";
import { planName } from "@/lib/billing/plan-name";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { createRequestKey } from "@/lib/billing/request-key";
import { isPollingView, setupViewOf } from "@/lib/billing/setup-view";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { localePath } from "@/lib/i18n/locales";
import { PG_TERMS } from "@/content/billing/pg-terms";
import { useWorkspaceBilling } from "@/lib/billing/use-workspace-billing";

type Purpose = "PURCHASE" | "REPLACE";
type Notice =
  | "stateChanged"
  | "inProgress"
  | "cardRejected"
  | "replaceRejected"
  | { message: string };

/** 카드 변경 결과를 기다리는 한도. 넘으면 결과 화면에 맡긴다(그 화면이 계속 읽는다). */
const REPLACE_WAIT_MS = 20_000;

/**
 * 카드 변경을 낸 뒤 그 등록이 끝날 때까지 1초마다 읽는다(한도 `REPLACE_WAIT_MS`). 화면을 채우는 폴링이 아니라 방금 낸 제출의
 * 결과를 기다리는 것이라 제출 처리 안에서 기다린다. 한도를 넘으면 `null`(결과 화면에 맡긴다).
 */
async function settledView(setupId: string) {
  const deadline = Date.now() + REPLACE_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await getMyBillingSetup(setupId).catch(() => undefined);
    const setup = okData(response);
    const view = setup ? setupViewOf(setup) : null;
    if (view && !isPollingView(view)) return view;
  }
  return null;
}

const SECTION_TITLE = "mb-3 text-sm font-medium text-[var(--el-ink)]";

/**
 * 주문·카드·동의를 한 번에 받는 양식(APP-1600). 첫 구독의 전용 결제 페이지(`/billing/checkout/{id}`, `PURCHASE`)와 카드 변경
 * 모달 안의 문서(`/billing/card-change/{id}`, `REPLACE`)가 쓴다. 둘 다 분석 스크립트가 없는 문서(`app/(card-entry)`)다 —
 * 카드 칸이 있는 문서에 제3자 스크립트를 두지 않는다. 그래서 이 양식은 분석 이벤트를 내지 않는다.
 *
 * **금액·상품은 서버 응답만 그린다.** 카드 칸이 모두 맞고 두 동의가 체크돼야 낼 수 있다. 내면 등록을 열고(이미 연 등록·카드를
 * 기다리는 내 등록이면 그것) 카드를 낸다. 카드 정보는 이 상태에만 살고, 카드 제출은 훅(`useMutation`) 없이 부른다 — 뮤테이션
 * 캐시가 변수를 들고 전역 `MutationCache.onSuccess` 가 변수를 분석 이벤트에 넘기기 때문이다.
 *
 * - 400(입력 거절)·429(시도 제한)는 이 자리에서 알리고 입력을 둔다
 * - 첫 구독: 제출이 끝나면(409·결과 불명 포함) 결과 화면으로(`onResult`)
 * - 카드 변경: 등록 결과를 읽어 완료면 `onChanged`, 거절이면 이 자리에서 알리고 새 등록으로 다시 받는다. 그 밖은 결과 화면으로
 */
export function CheckoutForm({
  workspaceId,
  purpose,
  backHref,
  onResult,
  onChanged,
  onSubmittingChange,
}: {
  workspaceId: string;
  purpose: Purpose;
  /** 지금 낼 수 없을 때 돌아갈 곳. 모달 안에서는 없다(닫기가 있다). */
  backHref?: string;
  /** 결과 화면을 볼 차례. */
  onResult: (setupId: string) => void;
  /** 카드 변경이 끝났다. */
  onChanged?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
}) {
  const replace = purpose === "REPLACE";
  const t = useTranslations("billing.checkout");
  const locale = useLocale();
  const format = useBillingFormat();
  const queryClient = useQueryClient();
  const billing = useWorkspaceBilling(workspaceId);
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);
  const key = useRef(createRequestKey()).current;
  const [card, setCard] = useState<CardForm>(EMPTY_CARD);
  const [agreed, setAgreed] = useState(false);
  const [pgAgreed, setPgAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // 이 양식에서 연 등록. 카드가 거절돼도(400) 다시 내면 새로 열지 않고 이 등록에 낸다.
  const openedSetupId = useRef<string | null>(null);
  const create = useCreateBillingSetup({
    mutation: {
      meta: {
        suppressErrorToast: ["BILLING_STATE_CHANGED", "BILLING_IN_PROGRESS"],
      },
    },
  });
  const cancel = useCancelBillingSetup();
  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [onSubmittingChange, submitting]);

  const product = billing.product;
  const admin = workspace?.role === "ADMIN";
  // 카드를 기다리는 내 등록(CONTINUE_SETUP)은 새로 열지 않고 그 등록에 카드를 낸다. 서버가 이미 처리 중인 등록만 「진행 중」으로 알린다.
  const continuable = billing.allowedActions.includes("CONTINUE_SETUP");
  const openSetupId = continuable ? null : billing.mySetupId;
  const back = backHref ? (
    <LinkButton href={backHref} variant="outline" className="mt-3">
      {t("backToPlans")}
    </LinkButton>
  ) : null;

  if (!admin)
    return (
      <BillingNotice>
        <p>{replace ? t("replace.askAdmin") : t("askAdmin")}</p>
        {back}
      </BillingNotice>
    );
  if (billing.teamSetupInProgress)
    return (
      <BillingNotice>
        <p>{t("inProgress")}</p>
        {back}
      </BillingNotice>
    );
  if (
    !product ||
    (!billing.allowedActions.includes(
      replace ? "CHANGE_CARD" : "START_PURCHASE"
    ) &&
      !billing.mySetupId)
  ) {
    return (
      <BillingNotice>
        <p>{replace ? t("replace.unavailable") : t("unavailable")}</p>
        {back}
      </BillingNotice>
    );
  }
  // 자동 갱신 동의는 금액과 주기를 문장에 직접 적는다.
  // 종료 예정인 구독은 카드를 등록해도 재개하기 전에는 결제되지 않는다 — 동의 문장도 그렇게 말한다.
  const agreementLabel = t(
    !replace
      ? "agreementLabel"
      : billing.cancelAtPeriodEnd
        ? "replace.agreementLabelEnding"
        : "replace.agreementLabel",
    { amount: format.money(product.amountKrw) }
  );
  const errors = cardErrors(card, new Date());
  const ready =
    agreed && pgAgreed && Object.keys(errors).length === 0 && !openSetupId;

  const submit = async () => {
    if (submitting || !ready) return;
    setSubmitting(true);
    setNotice(null);
    let step: "open" | "card" = "open";
    let setupId: string | null = null;
    let leaving = false;
    try {
      setupId =
        openedSetupId.current ?? (continuable ? billing.mySetupId : null);
      if (!setupId) {
        // 등록 열기 실패는 생성 훅이라 전역 토스트가 띄운다(상태 변경·진행 중은 아래가 알린다).
        const response = await create.mutateAsync({
          workspaceId,
          data: {
            requestKey: key.current(),
            purpose,
            expectedProductVersion: product.policyVersion,
            agreementVersion: product.agreementVersion,
          },
        });
        const setup = response.data.data;
        if (!setup) return;
        key.renew();
        setupId = openedSetupId.current = setup.setupId;
        // 요금제 탭으로 돌아가도 이 등록이 「이어가기」로 보이게 공간 조회를 새로 읽힌다.
        void invalidateWorkspaceBilling(queryClient, workspaceId);
      }
      step = "card";
      await submitBillingCard(workspaceId, setupId, cardRequestOf(card), {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      setCard(EMPTY_CARD);
      if (!replace) {
        leaving = true;
        onResult(setupId);
        return;
      }
      const view = await settledView(setupId);
      if (view === "completed") {
        leaving = true;
        onChanged?.();
      } else if (view === "cardActionRequired") {
        // 이 등록은 끝났다 — 다음 제출은 새 등록으로 연다. 공간 조회도 새로 읽어 끝난 등록을 「이어가기」로 집지 않게 한다.
        openedSetupId.current = null;
        key.renew();
        setNotice("replaceRejected");
        await invalidateWorkspaceBilling(queryClient, workspaceId);
      } else {
        // 발급 결과 불명·닫힘·오래 걸림 — 결과 화면이 계속 읽는다.
        leaving = true;
        onResult(setupId);
      }
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null;
      const code = errorCodeOf(error);
      if (step === "card") {
        if (status === 400) setNotice("cardRejected");
        else if (error instanceof ApiError && status === 429)
          // 시도 제한. 봉투가 없으면 fetcher 가 `HTTP_429` 로 채운다 — 그때만 이 화면의 문구를 쓴다.
          setNotice(
            error.error.code === "HTTP_429"
              ? { message: t("tooManyAttempts") }
              : { message: error.error.message }
          );
        else if (!isAuthError(error) && setupId) {
          // 409(등록이 더는 카드를 받지 않음)·시한 초과·연결 끊김·5xx — 카드가 처리됐을 수 있어 결과 화면이 상태를 읽는다.
          leaving = true;
          onResult(setupId);
        }
      } else if (code === "BILLING_STATE_CHANGED") {
        // 화면이 본 상품·상태가 서버와 다르다 — 새로 읽고 동의를 다시 받는다(같은 키에 다른 본문은 충돌이라 키도 새로).
        key.renew();
        setAgreed(false);
        setNotice("stateChanged");
        await invalidateWorkspaceBilling(queryClient, workspaceId);
      } else if (code === "BILLING_IN_PROGRESS") {
        setNotice("inProgress");
        await invalidateWorkspaceBilling(queryClient, workspaceId);
      } else if (code === "REQUEST_KEY_CONFLICT") {
        key.renew();
      }
    } finally {
      if (!leaving) setSubmitting(false);
    }
  };

  const restart = async () => {
    if (!openSetupId) return;
    const closed = await cancel
      .mutateAsync({ workspaceId, setupId: openSetupId })
      .then(() => true)
      .catch(() => false);
    if (!closed) return;
    openedSetupId.current = null;
    key.renew();
    await invalidateWorkspaceBilling(queryClient, workspaceId);
  };

  const noticeText =
    notice === null
      ? null
      : typeof notice === "object"
        ? notice.message
        : notice === "cardRejected"
          ? t("cardRejected")
          : notice === "replaceRejected"
            ? t("replace.rejected")
            : t(`notice.${notice}`);

  const agreements = (
    <div className="flex flex-col gap-4">
      {replace ? null : (
        <p className="text-xs leading-5 text-[var(--el-muted)]">
          {t.rich("refundPolicy", {
            // 새 탭으로 열어 입력한 카드·동의 상태를 잃지 않는다(`SitePageLink`). 앵커는 약관 제13조(환불).
            link: (chunks) => (
              <SitePageLink
                href={localePath(locale, "/terms#section-13")}
                className="whitespace-nowrap underline underline-offset-2 hover:text-[var(--el-ink)]"
              >
                {chunks}
              </SitePageLink>
            ),
          })}
        </p>
      )}
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-[var(--el-ink)]">
        <Checkbox
          className="mt-0.5"
          checked={agreed}
          onCheckedChange={setAgreed}
          disabled={submitting}
          aria-label={agreementLabel}
        />
        <span>{agreementLabel}</span>
      </label>
      <div className="flex items-start gap-2.5 text-sm leading-5 text-[var(--el-ink)]">
        <label className="flex cursor-pointer items-start gap-2.5">
          <Checkbox
            className="mt-0.5"
            checked={pgAgreed}
            onCheckedChange={setPgAgreed}
            disabled={submitting}
          />
          <span>{t("pgAgreementLabel")}</span>
        </label>
        <PgTermsDialog />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {replace ? (
        <ReplaceSummary billing={billing} />
      ) : (
        <section>
          <h2 className={SECTION_TITLE}>{t("priceTitle")}</h2>
          <PurchaseSummary
            billing={billing}
            workspaceName={workspace?.name ?? ""}
          />
        </section>
      )}
      {openSetupId ? (
        <BillingNotice tone="warn" title={t("openSetup.title")}>
          <p>{t("openSetup.body")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton
              href={`/billing/setups/${openSetupId}`}
              variant="outline"
            >
              {t("openSetup.view")}
            </LinkButton>
            <Button onClick={restart} loading={cancel.isPending}>
              {t("openSetup.restart")}
            </Button>
          </div>
        </BillingNotice>
      ) : null}
      <CardFields
        value={card}
        onChange={setCard}
        errors={errors}
        disabled={submitting}
      />
      {replace ? (
        agreements
      ) : (
        <section>
          <h2 className={SECTION_TITLE}>{t("agreementTitle")}</h2>
          {agreements}
        </section>
      )}
      <div className="flex flex-col gap-4">
        {noticeText ? (
          <BillingNotice tone="warn">{noticeText}</BillingNotice>
        ) : null}
        <div>
          <Button
            className="h-10 px-4"
            disabled={!ready}
            aria-describedby={ready ? undefined : "billing-agree-hint"}
            loading={submitting}
            onClick={submit}
          >
            {replace ? t("replace.submit") : t("submit")}
            <ArrowRight aria-hidden />
          </Button>
          <span id="billing-agree-hint" className="sr-only">
            {t("agreeFirst")}
          </span>
        </div>
        {replace ? null : (
          <TestPaymentNotice notice={product.testPaymentNotice ?? undefined} />
        )}
      </div>
    </div>
  );
}

type Billing = ReturnType<typeof useWorkspaceBilling>;

/** 첫 구독의 요금 확인 — 상품·공간·금액, 혜택(체크)과 결제 조건(점), 오늘 결제·다음 결제 예정일. */
function PurchaseSummary({
  billing,
  workspaceName,
}: {
  billing: Billing;
  workspaceName: string;
}) {
  const t = useTranslations("billing.checkout");
  const format = useBillingFormat();
  const product = billing.product!;
  const points = [
    format.allowance(product.recordingAllowanceMinutes),
    t("shared"),
  ];
  // 혜택(체크)과 결제 조건(점)을 가른다 — 둘 다 체크면 해지 규칙까지 혜택처럼 읽힌다(APP-1596).
  const terms = [t("autoRenew"), t("cancelInfo"), t("cancelHow")];
  return (
    <div className={SETTINGS_LIST}>
      <div className="flex items-center justify-between gap-4 px-5 py-5">
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-[var(--el-ink)]">
            {t("productName", { plan: planName(product.planCode) })}
          </p>
          <p className="mt-1 truncate text-sm text-[var(--el-muted)]">
            {workspaceName}
          </p>
        </div>
        <p className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[28px] leading-8 font-light tracking-[-0.03em] text-[var(--el-ink)]">
            {format.money(product.amountKrw)}
          </span>
          <span className="text-sm text-[var(--el-muted)]">
            {t("perMonth")}
          </span>
        </p>
      </div>
      <div className="px-5 py-4 text-sm leading-5 text-[var(--el-body)]">
        <ul className="grid gap-2.5">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2">
              <Check
                className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]"
                aria-hidden
              />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-[var(--el-muted)]">
          {t("paymentInfo")}
        </p>
        <ul className="mt-2.5 grid gap-2">
          {terms.map((term) => (
            <li key={term} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mx-1.5 mt-2 size-1 shrink-0 rounded-full bg-[var(--el-muted-soft)]"
              />
              <span className="text-pretty">{term}</span>
            </li>
          ))}
        </ul>
      </div>
      <dl className="grid gap-2.5 bg-[var(--el-canvas-soft)] px-5 py-3.5 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[var(--el-muted)]">{t("dueToday")}</dt>
          <dd className="font-medium whitespace-nowrap text-[var(--el-ink)]">
            {format.money(product.amountKrw)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[var(--el-muted)]">{t("nextCharge")}</dt>
          <dd className="whitespace-nowrap text-[var(--el-ink)]">
            {format.date(nextMonthlyChargeAt(new Date()))}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** 카드 변경의 요약 — 지금 카드·다음 결제와, 지금 결제되지 않는다는 등 짧은 안내. */
function ReplaceSummary({ billing }: { billing: Billing }) {
  const t = useTranslations("billing.checkout");
  const format = useBillingFormat();
  const currentCard = format.card(billing.detail?.maskedCard);
  // 카드가 없으면 「지금 카드」와 「실패하면 지금 카드 유지」가 거짓이다. 남의 카드·카드 없음이면 결제자가 내가 된다.
  const register = !billing.detail?.methodId;
  const period = billing.currentPeriod;
  const nextCharge =
    billing.status === "ACTIVE" && !billing.cancelAtPeriodEnd ? period : null;
  const points = [
    t(register ? "replace.register.noCharge" : "replace.noCharge"),
    register ? null : t("replace.keepOnFail"),
    billing.detail?.methodPayerIsMe === true ? null : t("replace.payerChanges"),
  ].filter((point): point is string => Boolean(point));
  return (
    <div className="flex flex-col gap-3 text-sm">
      {currentCard || nextCharge ? (
        <dl className="grid gap-1.5">
          {currentCard ? (
            <Row label={t("replace.current")} value={currentCard} />
          ) : null}
          {nextCharge ? (
            <Row
              label={t("replace.nextCharge")}
              value={
                billing.detail?.nextChargeAmountKrw != null
                  ? `${format.date(nextCharge.end)} · ${format.money(billing.detail.nextChargeAmountKrw)}`
                  : format.date(nextCharge.end)
              }
            />
          ) : null}
        </dl>
      ) : null}
      <ul className="grid gap-1.5 text-xs leading-5 text-[var(--el-muted)]">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--el-muted)]">{label}</dt>
      <dd className="text-right whitespace-nowrap text-[var(--el-ink)]">
        {value}
      </dd>
    </div>
  );
}

/** 결제 대행 서비스 이용약관 「내용 보기」. 본문은 문구 파일이 아니라 `content/billing/pg-terms.ts` 다. */
function PgTermsDialog() {
  const t = useTranslations("billing.checkout");
  const locale = useLocale();
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="shrink-0 whitespace-nowrap text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
          />
        }
      >
        {t("pgTermsView")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("pgTermsTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto text-sm leading-6 text-[var(--el-body)]">
          {PG_TERMS[locale === "en" ? "en" : "ko"].map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
