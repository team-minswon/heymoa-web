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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  submitBillingCard,
  useCreateBillingSetup,
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
import { planName } from "@/lib/billing/plan-name";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { createRequestKey } from "@/lib/billing/request-key";
import { setupViewOf } from "@/lib/billing/setup-view";
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

const SECTION_TITLE = "mb-3 text-sm font-medium text-[var(--el-ink)]";

/**
 * 카드 제출은 `useMutation` 없이 부릅니다 — TanStack 의 뮤테이션 캐시가 변수를 들고, 전역 `MutationCache.onSuccess` 가
 * 변수를 분석 이벤트에 넘깁니다. 카드 정보는 이 상태에만 살고 제출이 끝나면 성패와 상관없이 비웁니다.
 */
export function CheckoutForm({
  workspaceId,
  purpose,
  backHref,
  onResult,
  onChanged,
  onSubmittingChange,
  nextChargeAt,
}: {
  workspaceId: string;
  purpose: Purpose;
  nextChargeAt?: string;
  backHref?: string;
  onResult: (setupId: string) => void;
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
  const [cleared, setCleared] = useState(0);
  const numberRef = useRef<HTMLInputElement>(null);
  const [agreed, setAgreed] = useState(false);
  const [pgAgreed, setPgAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const openedSetupId = useRef<string | null>(null);
  const create = useCreateBillingSetup({
    mutation: {
      meta: {
        suppressErrorToast: [
          "BILLING_STATE_CHANGED",
          "BILLING_IN_PROGRESS",
          "REQUEST_TIMEOUT",
        ],
      },
    },
    request: { timeoutMs: REQUEST_TIMEOUT_MS },
  });
  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [onSubmittingChange, submitting]);
  useEffect(() => {
    if (cleared > 0) numberRef.current?.focus();
  }, [cleared]);

  const product = billing.product;
  const admin = workspace?.role === "ADMIN";
  const continuable = billing.allowedActions.includes("CONTINUE_SETUP");
  const openSetupId = continuable ? null : billing.mySetupId;
  const back = backHref ? (
    <LinkButton href={backHref} variant="outline" className="mt-3">
      {t("backToPlans")}
    </LinkButton>
  ) : null;

  const toWorkspace = backHref ? (
    <LinkButton href={`/w/${workspaceId}`} variant="outline" className="mt-3">
      {t("backToWorkspace")}
    </LinkButton>
  ) : null;
  if (!replace && !billing.enforced)
    return (
      <BillingNotice title={t("closed.title")}>
        <p>{t("closed.body")}</p>
        {toWorkspace}
      </BillingNotice>
    );
  if (!replace && billing.status === "ACTIVE")
    return (
      <BillingNotice>
        <p>{t("alreadyPro")}</p>
        {toWorkspace}
      </BillingNotice>
    );
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
  const chargeAmount = replace
    ? (billing.detail?.nextChargeAmountKrw ?? product.amountKrw)
    : product.amountKrw;
  const pastDue = replace && billing.status === "PAST_DUE";
  const agreementLabel = t(
    !replace
      ? "agreementLabel"
      : pastDue
        ? billing.cancelAtPeriodEnd
          ? "replace.agreementLabelPastDueEnding"
          : "replace.agreementLabelPastDue"
        : billing.cancelAtPeriodEnd
          ? "replace.agreementLabelEnding"
          : "replace.agreementLabel",
    { amount: format.money(chargeAmount) }
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
        void invalidateWorkspaceBilling(queryClient, workspaceId);
      }
      step = "card";
      const submitted = okData(
        await submitBillingCard(workspaceId, setupId, cardRequestOf(card), {
          timeoutMs: REQUEST_TIMEOUT_MS,
        })
      );
      if (!replace) {
        leaving = true;
        onResult(setupId);
        return;
      }
      const view = submitted ? setupViewOf(submitted) : null;
      if (view === "completed") {
        leaving = true;
        onChanged?.();
      } else if (view === "cardActionRequired") {
        openedSetupId.current = null;
        key.renew();
        setNotice("replaceRejected");
        await invalidateWorkspaceBilling(queryClient, workspaceId);
      } else {
        leaving = true;
        onResult(setupId);
      }
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null;
      const code = errorCodeOf(error);
      if (step === "card") {
        if (status === 400) setNotice("cardRejected");
        else if (error instanceof ApiError && status === 429)
          setNotice(
            error.error.code === "HTTP_429"
              ? { message: t("tooManyAttempts") }
              : { message: error.error.message }
          );
        else if (!isAuthError(error) && setupId) {
          leaving = true;
          onResult(setupId);
        }
      } else if (code === "BILLING_STATE_CHANGED") {
        key.renew();
        setAgreed(false);
        setNotice("stateChanged");
        await invalidateWorkspaceBilling(queryClient, workspaceId);
      } else if (code === "REQUEST_TIMEOUT") {
        setNotice({ message: t("openTimeout") });
      } else if (code === "BILLING_IN_PROGRESS") {
        setNotice("inProgress");
        await invalidateWorkspaceBilling(queryClient, workspaceId);
      } else if (code === "REQUEST_KEY_CONFLICT") {
        key.renew();
      }
    } finally {
      if (step === "card") {
        setCard((prev) => ({ ...EMPTY_CARD, holder: prev.holder }));
        setCleared((count) => count + 1);
      }
      if (!leaving) setSubmitting(false);
    }
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
        <ReplaceSummary billing={billing} amount={chargeAmount} />
      ) : (
        <section>
          <h2 className={SECTION_TITLE}>{t("priceTitle")}</h2>
          <PurchaseSummary
            billing={billing}
            workspaceName={workspace?.name ?? ""}
            nextChargeAt={nextChargeAt}
          />
        </section>
      )}
      {openSetupId ? (
        <BillingNotice tone="warn" title={t("openSetup.title")}>
          <p>{t("openSetup.body")}</p>
          <LinkButton
            href={`/billing/setups/${openSetupId}`}
            variant="outline"
            className="mt-3"
          >
            {t("openSetup.view")}
          </LinkButton>
        </BillingNotice>
      ) : null}
      <CardFields
        key={cleared}
        numberRef={numberRef}
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

function PurchaseSummary({
  billing,
  workspaceName,
  nextChargeAt,
}: {
  billing: Billing;
  workspaceName: string;
  nextChargeAt?: string;
}) {
  const t = useTranslations("billing.checkout");
  const format = useBillingFormat();
  const product = billing.product!;
  const points = [
    format.allowance(product.recordingAllowanceMinutes),
    t("shared"),
  ];
  const terms = [t("autoRenew")];
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
        {nextChargeAt ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--el-muted)]">{t("nextCharge")}</dt>
            <dd className="whitespace-nowrap text-[var(--el-ink)]">
              {format.date(nextChargeAt)}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function ReplaceSummary({
  billing,
  amount,
}: {
  billing: Billing;
  amount: number;
}) {
  const t = useTranslations("billing.checkout");
  const format = useBillingFormat();
  const currentCard = format.card(billing.detail?.maskedCard);
  const register = !billing.detail?.methodId;
  const period = billing.currentPeriod;
  const nextCharge =
    billing.status === "ACTIVE" && !billing.cancelAtPeriodEnd ? period : null;
  const points = [
    billing.status === "PAST_DUE"
      ? t("replace.pastDueCharge", { amount: format.money(amount) })
      : t(register ? "replace.register.noCharge" : "replace.noCharge"),
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
              value={`${format.date(nextCharge.end)} · ${format.money(amount)}`}
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
          {locale === "ko" ? null : (
            <DialogDescription>{t("pgTermsKoreanOnly")}</DialogDescription>
          )}
        </DialogHeader>
        <div lang="ko" className="grid gap-4">
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {PG_TERMS.map((terms) => (
              <a
                key={terms.type}
                href={`#pg-terms-${terms.type}`}
                className="text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
              >
                {terms.title}
              </a>
            ))}
          </nav>
          <div className="grid max-h-[60vh] gap-8 overflow-y-auto text-sm leading-6 text-[var(--el-body)]">
            {PG_TERMS.map((terms) => (
              <section
                key={terms.type}
                id={`pg-terms-${terms.type}`}
                aria-labelledby={`pg-terms-${terms.type}-title`}
                className="grid gap-3"
              >
                <h3
                  id={`pg-terms-${terms.type}-title`}
                  className="font-medium text-[var(--el-ink)]"
                >
                  {terms.title}
                </h3>
                {terms.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
