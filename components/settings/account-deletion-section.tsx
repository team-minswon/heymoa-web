"use client";

import { useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
import { SitePageLink } from "@/components/heymoa/site-page-link";
import { ConfirmPhraseField } from "@/components/settings/confirm-phrase-field";
import {
  isRecordingLive,
  useRecording,
} from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineRetry } from "@/components/ui/inline-retry";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmationMatches,
  useDeleteAccount,
  useDeletionPlan,
  WITHDRAWAL_CONFIRMATION,
  WITHDRAWAL_DETAIL_MAX,
  WITHDRAWAL_REASON_CODES,
  type DeletionPlanWorkspace,
  type WithdrawalReasonCode,
} from "@/lib/account/deletion-api";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { markAccountDeleted } from "@/components/auth/account-deleted-notice";
import { forgetDeletedAccount } from "@/lib/storage/user-flags";
import { cn } from "@/lib/utils";
import { localePath } from "@/lib/i18n/locales";

/** 유일 관리자 워크스페이스에서 고른 것. 기본은 서버가 정한 가장 오래된 멤버에게 넘기기다. */
type Choice =
  | { decision: "TRANSFER"; successorUserId: string }
  | { decision: "DELETE" };

/**
 * 설정 > 내 계정 맨 아래 「계정 삭제」(PRO-69 userflow 「계정 탈퇴」, APP-1383).
 *
 * 처리 목록은 서버가 계산하고, 요청 때 서버가 같은 규칙으로 다시 판정한다 — 화면은 고른 것만 보낸다.
 * 사유는 건너뛸 수 있다. 버튼은 「회원 탈퇴」 입력만으로 켜진다(권리 행사를 어렵게 하지 않는다).
 */
export function AccountDeletionSection() {
  const t = useTranslations("settings.accountDeletion");
  const [open, setOpen] = useState(false);
  return (
    <section
      aria-labelledby="account-deletion-title"
      className="rounded-panel border border-[var(--el-hairline)] bg-white p-6"
    >
      <h3
        id="account-deletion-title"
        className="text-sm font-medium text-[var(--el-ink)]"
      >
        {t("title")}
      </h3>
      <p className="mt-1 text-xs leading-5 text-[var(--el-muted)]">
        {t("description")}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-[30px]"
        onClick={() => setOpen(true)}
      >
        {t("title")}
      </Button>
      {open ? <AccountDeletionDialog onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

function AccountDeletionDialog({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  const t = useTranslations("settings.accountDeletion");
  const tActions = useTranslations("common.actions");
  const { user, leave } = useAuth();
  const recording = useRecording();
  const recordingNow = isRecordingLive(recording);
  const plan = useDeletionPlan(true);
  const deleteAccount = useDeleteAccount();
  const reasonId = useId();

  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [reason, setReason] = useState<WithdrawalReasonCode | null>(null);
  const [detail, setDetail] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  /**
   * 화면 언어로 입력받는 확인 문구. 계약(`confirmation`)은 「회원 탈퇴」 하나라, 영어 화면에서 맞게 입력하면 계약 값을
   * 대신 보낸다 — 한국어 입력기가 없는 사람도 탈퇴할 수 있어야 한다. 실수로 지우지 않게 하는 관문은 이 입력 그대로다.
   */
  const phrase = t("confirmPhrase");
  const busy = deleteAccount.isPending;
  const workspaces = plan.data?.workspaces;
  const ready =
    workspaces !== undefined &&
    confirmationMatches(typed, phrase) &&
    !recordingNow &&
    !busy;

  function choiceOf(row: DeletionPlanWorkspace): Choice {
    return (
      choices[row.workspaceId] ?? {
        decision: "TRANSFER",
        successorUserId:
          row.defaultSuccessorUserId ??
          row.successorCandidates[0]?.userId ??
          "",
      }
    );
  }

  async function submit() {
    if (!ready || !workspaces) return;
    setError(null);
    try {
      await deleteAccount.mutateAsync({
        confirmation: WITHDRAWAL_CONFIRMATION,
        workspaces: workspaces
          .filter((row) => row.action === "TRANSFER_OR_DELETE")
          .map((row) => ({ workspaceId: row.workspaceId, ...choiceOf(row) })),
        reason: reason
          ? {
              code: reason,
              detail:
                reason === "OTHER" && detail.trim() ? detail.trim() : undefined,
            }
          : undefined,
      });
    } catch (failure) {
      // 그사이 멤버가 바뀌었으면 목록을 새로 받는다 — 같은 선택으로 다시 보내면 또 거절된다.
      if (errorCodeOf(failure) === "DELETION_PLAN_CHANGED") {
        setChoices({});
        void plan.refetch();
      }
      setError(errorMessageOf(failure, t("failed")));
      return;
    }
    // 홈으로 보낸다. 완료 안내는 홈에서 짧은 토스트로 한 번 띄운다(`AccountDeletedNotice`).
    markAccountDeleted();
    if (user) await forgetDeletedAccount(user.userId);
    leave("/");
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // 요청 중에는 닫지 않는다 — 창만 사라지면 취소한 줄 알지만 탈퇴는 계속 간다.
        if (!next && !deleteAccount.isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!deleteAccount.isPending}
        className="flex max-h-[calc(100dvh-3rem)] flex-col gap-0 p-0 sm:max-w-[520px]"
      >
        <DialogHeader className="gap-1 px-5 pt-5 pb-1">
          <DialogTitle className="text-[17px] font-semibold text-balance">
            {t("dialog.title")}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {t("dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-3.5 pb-4">
          <section aria-labelledby={reasonId}>
            <SectionLabel id={reasonId}>
              {t("reason.label")}{" "}
              <span className="font-normal text-[var(--el-muted)]">
                {t("reason.optional")}
              </span>
            </SectionLabel>
            <div className="flex flex-wrap gap-2">
              {WITHDRAWAL_REASON_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={reason === code}
                  disabled={busy}
                  // 하나만 고른다. 다시 누르면 고르지 않은 상태로 돌아간다(건너뛸 수 있다).
                  onClick={() => setReason(reason === code ? null : code)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors disabled:opacity-50",
                    reason === code
                      ? "border-[var(--el-ink)] bg-[var(--el-ink)] text-white"
                      : "border-[var(--el-hairline)] text-[var(--el-body)] hover:bg-[var(--el-canvas-soft)]"
                  )}
                >
                  {t(`reason.codes.${code}`)}
                </button>
              ))}
            </div>
            {reason === "OTHER" ? (
              <div className="mt-3 grid gap-1.5">
                <Textarea
                  aria-label={t("reason.otherLabel")}
                  value={detail}
                  maxLength={WITHDRAWAL_DETAIL_MAX}
                  disabled={busy}
                  rows={3}
                  placeholder={t("reason.otherPlaceholder")}
                  onChange={(event) => setDetail(event.target.value)}
                />
                <span className="justify-self-end text-xs text-[var(--el-muted)] tabular-nums">
                  {detail.length} / {WITHDRAWAL_DETAIL_MAX}
                </span>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-[var(--el-muted)]">
              {t("reason.note")}
            </p>
          </section>

          <section aria-label={t("plan.label")}>
            <SectionLabel>{t("plan.label")}</SectionLabel>
            {plan.isPending ? (
              <div className="space-y-2" aria-label={t("plan.loading")}>
                <Skeleton className="h-12 rounded-block" />
                <Skeleton className="h-12 rounded-block" />
              </div>
            ) : plan.isError ? (
              <InlineRetry
                variant="line"
                label={t("plan.loadFailed")}
                onRetry={() => void plan.refetch()}
              />
            ) : workspaces && workspaces.length > 0 ? (
              <ul className="divide-y divide-[var(--el-hairline)] rounded-block border border-[var(--el-hairline)]">
                {workspaces.map((row) => (
                  <PlanRow
                    key={row.workspaceId}
                    row={row}
                    choice={choiceOf(row)}
                    disabled={busy}
                    onChange={(choice) =>
                      setChoices((current) => ({
                        ...current,
                        [row.workspaceId]: choice,
                      }))
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--el-muted)]">
                {t("plan.empty")}
              </p>
            )}
          </section>

          <section aria-label={t("effects.label")}>
            <SectionLabel>{t("effects.label")}</SectionLabel>
            {/* 사업자 이름·내부 항목은 나열하지 않는다. 기간은 처리방침 6조가 원본이다(APP-1403). */}
            <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[var(--el-body)]">
              <li>
                {t.rich("effects.deleted", {
                  nowrap: (chunks) => (
                    <span className="whitespace-nowrap">{chunks}</span>
                  ),
                })}
              </li>
              <li>{t("effects.conversations")}</li>
              <li>{t("effects.sharedHistory")}</li>
              <li>{t("effects.external")}</li>
              <li>
                {t("effects.retained")}{" "}
                <SitePageLink
                  href={localePath(locale, "/privacy#section-6")}
                  className="whitespace-nowrap underline underline-offset-2 hover:text-[var(--el-ink)]"
                >
                  {t("effects.retentionLink")}
                </SitePageLink>
              </li>
            </ul>
          </section>

          <ConfirmPhraseField
            phrase={phrase}
            value={typed}
            onChange={setTyped}
            disabled={busy}
          />

          {recordingNow ? (
            <p role="status" className="text-xs text-[var(--el-muted)]">
              {t("recordingBlocked")}
            </p>
          ) : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-[var(--el-hairline)] px-5 py-4">
          <Button
            variant="outline"
            disabled={deleteAccount.isPending}
            onClick={onClose}
          >
            {tActions("cancel")}
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            disabled={!ready}
            onClick={() => void submit()}
          >
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanRow({
  row,
  choice,
  disabled,
  onChange,
}: {
  row: DeletionPlanWorkspace;
  choice: Choice;
  disabled: boolean;
  onChange: (choice: Choice) => void;
}) {
  const t = useTranslations("settings.accountDeletion.plan");
  const groupName = useId();
  const fixed =
    row.action === "DELETE"
      ? t("deleteSolo")
      : row.action === "LEAVE"
        ? t("leaveShared")
        : null;

  return (
    <li className="px-3 py-2.5">
      <p className="truncate text-[13px] font-medium text-[var(--el-ink)]">
        {row.name}
      </p>
      {fixed ? (
        <p className="mt-0.5 text-xs text-[var(--el-muted)]">{fixed}</p>
      ) : (
        <fieldset className="mt-1.5 grid gap-1.5" disabled={disabled}>
          <legend className="sr-only">{t("legend", { name: row.name })}</legend>
          <p className="text-xs text-[var(--el-muted)]">
            {t("soleAdmin")}
          </p>
          <div className="flex items-center gap-2 text-[13px] text-[var(--el-body)]">
            <label className="flex shrink-0 items-center gap-2">
              <input
                type="radio"
                name={groupName}
                checked={choice.decision === "TRANSFER"}
                onChange={() =>
                  onChange({
                    decision: "TRANSFER",
                    successorUserId:
                      row.defaultSuccessorUserId ??
                      row.successorCandidates[0]?.userId ??
                      "",
                  })
                }
              />
              <span className="whitespace-nowrap">{t("transfer")}</span>
            </label>
            <Select
              items={Object.fromEntries(
                row.successorCandidates.map((member) => [
                  member.userId,
                  member.name,
                ])
              )}
              value={
                choice.decision === "TRANSFER"
                  ? choice.successorUserId
                  : (row.defaultSuccessorUserId ?? "")
              }
              disabled={disabled || choice.decision !== "TRANSFER"}
              onValueChange={(userId) =>
                onChange({
                  decision: "TRANSFER",
                  successorUserId: String(userId),
                })
              }
            >
              <SelectTrigger
                className="min-w-0 flex-1"
                aria-label={t("successor", { name: row.name })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {row.successorCandidates.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name}({member.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[var(--el-body)]">
            <input
              type="radio"
              name={groupName}
              checked={choice.decision === "DELETE"}
              onChange={() => onChange({ decision: "DELETE" })}
            />
            {t("deleteWorkspace")}
          </label>
        </fieldset>
      )}
    </li>
  );
}

function SectionLabel({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <h4 id={id} className="mb-2 text-[13px] font-medium text-[var(--el-ink)]">
      {children}
    </h4>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] px-3 py-2.5"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
      <p className="text-xs leading-relaxed text-[var(--el-body)]">
        {children}
      </p>
    </div>
  );
}
