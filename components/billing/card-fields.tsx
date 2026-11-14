"use client";

import { LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type Ref } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CARD_NUMBER_MAX,
  digitsOf,
  formatCardNumber,
  formatExpiry,
  IDENTITY_LENGTH,
  type CardError,
  type CardField,
  type CardForm,
  type CardHolder,
} from "@/lib/billing/card-input";
import { cn } from "@/lib/utils";

/**
 * 주문서·카드 변경의 「카드 정보」 칸(APP-1600). 값은 부모의 상태(`CardForm`)가 갖고, 이 컴포넌트는 그리기·자릿수 거르기만 한다.
 * 틀린 칸은 한 번 떠난 뒤에만 그 아래 한 줄로 알린다 — 치는 도중에 빨간 글이 따라오지 않게.
 * 묶음과 칸마다 `ph-no-capture` 를 단다 — PostHog 가 자동 수집·세션 기록에서 그 요소를 빼는 공식 표시다. 이 칸이 서는 화면에는
 * 분석 스크립트가 없지만(`app/(card-entry)`), 실수로 실려도 기록되지 않게 한 겹 더 둔다.
 */
export function CardFields({
  value,
  onChange,
  errors,
  disabled,
  numberRef,
}: {
  numberRef?: Ref<HTMLInputElement>;
  value: CardForm;
  onChange: (next: CardForm) => void;
  errors: Partial<Record<CardField, CardError>>;
  disabled?: boolean;
}) {
  const t = useTranslations("billing.checkout.card");
  const id = useId();
  const [touched, setTouched] = useState<
    Partial<Record<CardField, true | undefined>>
  >({});
  const set = (patch: Partial<CardForm>) => onChange({ ...value, ...patch });
  const field = (name: CardField) => {
    const error = touched[name] ? errors[name] : undefined;
    return {
      props: {
        id: `${id}-${name}`,
        disabled,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? `${id}-${name}-error` : undefined,
        onBlur: () => setTouched((prev) => ({ ...prev, [name]: true })),
      },
      error: error ? (
        <p
          id={`${id}-${name}-error`}
          className="text-xs leading-4 text-[var(--el-error-strong)]"
        >
          {t(`error.${error}`)}
        </p>
      ) : null,
    };
  };
  const number = field("number");
  const expiry = field("expiry");
  const password = field("password");
  const identity = field("identity");
  const corporate = value.holder === "CORPORATE";

  return (
    <section aria-labelledby={`${id}-title`} className="ph-no-capture">
      <h3
        id={`${id}-title`}
        className="mb-3 text-sm font-medium text-[var(--el-ink)]"
      >
        {t("title")}
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-panel border border-[var(--el-hairline)] bg-white p-5">
        <div className="col-span-2 grid gap-2">
          <Label htmlFor={number.props.id}>{t("number")}</Label>
          <Input
            {...number.props}
            ref={numberRef}
            value={formatCardNumber(value.number)}
            onChange={(e) =>
              set({ number: digitsOf(e.target.value, CARD_NUMBER_MAX) })
            }
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            className="ph-no-capture tabular-nums"
          />
          {number.error}
        </div>
        <div className="grid min-w-0 content-start gap-2">
          <Label htmlFor={expiry.props.id}>{t("expiry")}</Label>
          <Input
            {...expiry.props}
            value={formatExpiry(value.expiry)}
            onChange={(e) => set({ expiry: digitsOf(e.target.value, 4) })}
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            className="ph-no-capture tabular-nums"
          />
          {expiry.error}
        </div>
        <div className="grid min-w-0 content-start gap-2">
          <Label htmlFor={password.props.id}>{t("password")}</Label>
          <Input
            {...password.props}
            type="password"
            value={value.password}
            onChange={(e) => set({ password: digitsOf(e.target.value, 2) })}
            inputMode="numeric"
            maxLength={2}
            autoComplete="off"
            className="ph-no-capture"
          />
          {password.error}
        </div>
        <div className="col-span-2 grid gap-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={identity.props.id}>
              {t(corporate ? "business" : "birth")}
            </Label>
            <HolderToggle
              value={value.holder}
              disabled={disabled}
              onChange={(holder) => {
                // 자리 수가 다른 값이라 바꾸면 비우고, 새 칸을 떠나기 전에는 알리지 않는다.
                set({ holder, identity: "" });
                setTouched((prev) => ({ ...prev, identity: undefined }));
              }}
            />
          </div>
          <Input
            {...identity.props}
            value={value.identity}
            onChange={(e) =>
              set({
                identity: digitsOf(
                  e.target.value,
                  IDENTITY_LENGTH[value.holder]
                ),
              })
            }
            inputMode="numeric"
            autoComplete="off"
            placeholder={corporate ? "0000000000" : "YYMMDD"}
            className="ph-no-capture tabular-nums"
          />
          {identity.error}
        </div>
      </div>
      <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-5 text-[var(--el-muted)]">
        <LockKeyhole className="mt-1 size-3 shrink-0" aria-hidden />
        <span className="text-pretty">{t("safe")}</span>
      </p>
    </section>
  );
}

function HolderToggle({
  value,
  onChange,
  disabled,
}: {
  value: CardHolder;
  onChange: (value: CardHolder) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("billing.checkout.card");
  return (
    <div
      role="radiogroup"
      aria-label={t("holder")}
      className="flex shrink-0 gap-0.5 rounded-control bg-[var(--el-canvas-soft)] p-0.5 text-xs"
    >
      {(["PERSONAL", "CORPORATE"] as const).map((holder) => (
        <button
          key={holder}
          type="button"
          role="radio"
          aria-checked={value === holder}
          disabled={disabled}
          onClick={() => onChange(holder)}
          className={cn(
            "h-6 rounded-[6px] px-2 whitespace-nowrap",
            value === holder
              ? "bg-white font-medium text-[var(--el-ink)] ring-1 ring-[var(--el-hairline)]"
              : "text-[var(--el-muted)]"
          )}
        >
          {t(holder === "PERSONAL" ? "personal" : "corporate")}
        </button>
      ))}
    </div>
  );
}
