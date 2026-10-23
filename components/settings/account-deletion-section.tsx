"use client";

import { useId, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
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
import {
  REAUTH_BLOCKED_MESSAGE,
  REAUTH_FAILED_MESSAGE,
  useReauth,
} from "@/lib/auth/reauth";
import { cn } from "@/lib/utils";

const REASON_LABEL: Record<WithdrawalReasonCode, string> = {
  MISSING_FEATURE: "필요한 기능이 없음",
  SECURITY_CONCERN: "보안·데이터가 걱정됨",
  TRANSCRIPTION_QUALITY: "전사·정리 품질",
  OTHER_SERVICE: "다른 서비스를 씀",
  RARELY_USED: "자주 쓰지 않음",
  OTHER: "기타",
};

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
        계정 삭제
      </h3>
      <p className="mt-1 text-xs leading-5 text-[var(--el-muted)]">
        계정과 혼자 쓰던 워크스페이스를 지우고 모든 기기에서 로그아웃합니다.
        되돌릴 수 없습니다.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-[30px]"
        onClick={() => setOpen(true)}
      >
        계정 삭제
      </Button>
      {open ? <AccountDeletionDialog onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

function AccountDeletionDialog({ onClose }: { onClose: () => void }) {
  const { leave } = useAuth();
  const recording = useRecording();
  const recordingNow = isRecordingLive(recording);
  const plan = useDeletionPlan(true);
  const deleteAccount = useDeleteAccount();
  const reauth = useReauth("ACCOUNT_DELETE");
  const reasonId = useId();

  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [reason, setReason] = useState<WithdrawalReasonCode | null>(null);
  const [detail, setDetail] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = reauth.waiting || deleteAccount.isPending;
  const workspaces = plan.data?.workspaces;
  const ready =
    workspaces !== undefined &&
    confirmationMatches(typed, WITHDRAWAL_CONFIRMATION) &&
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
    // 새 창은 클릭 처리기 안에서 기다리기 전에 연다(팝업 차단).
    const verified = await reauth.run();
    if (verified === "blocked") return setError(REAUTH_BLOCKED_MESSAGE);
    if (!verified.ok) return setError(REAUTH_FAILED_MESSAGE);
    try {
      await deleteAccount.mutateAsync({
        confirmation: typed.trim(),
        reauthProof: verified.proof,
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
      setError(errorMessageOf(failure, "계정을 삭제하지 못했습니다."));
      return;
    }
    leave("/account-deleted");
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        // 요청 중에는 닫지 않는다 — 창만 사라지면 취소한 줄 알지만 탈퇴는 계속 간다.
        if (!next && !deleteAccount.isPending) {
          reauth.cancel();
          onClose();
        }
      }}
    >
      <DialogContent
        showCloseButton={!deleteAccount.isPending}
        className="flex max-h-[calc(100dvh-3rem)] flex-col gap-0 p-0 sm:max-w-[520px]"
      >
        <DialogHeader className="gap-1 px-5 pt-5 pb-1">
          <DialogTitle className="text-[17px] font-semibold text-balance">
            계정을 삭제할까요?
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            삭제하면 되돌릴 수 없고, 같은 Google 계정으로 다시 가입하면 새
            계정이 됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-3.5 pb-4">
          <section aria-label="워크스페이스별 처리">
            <SectionLabel>워크스페이스별 처리</SectionLabel>
            {plan.isPending ? (
              <div className="space-y-2" aria-label="처리 목록 불러오는 중">
                <Skeleton className="h-12 rounded-block" />
                <Skeleton className="h-12 rounded-block" />
              </div>
            ) : plan.isError ? (
              <InlineRetry
                variant="line"
                label="처리 목록을 불러오지 못했습니다."
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
                속한 워크스페이스가 없습니다.
              </p>
            )}
          </section>

          <section aria-label="지워지는 것과 남는 것">
            <SectionLabel>지워지는 것과 남는 것</SectionLabel>
            <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[var(--el-body)]">
              <li>
                계정 정보와 삭제하는 워크스페이스의 노트·전사·음성·채팅·연동이
                지워집니다. 백업에는 최대 7일 남았다가 사라집니다.
              </li>
              <li>
                남는 팀 워크스페이스의 지난 회의 기록에는 내 이름과 발언이
                남습니다.
              </li>
              <li>
                보낸 문의 기록과 이용 통계(PostHog, 1년)는 처리방침에 적힌 기간
                동안 남습니다.
              </li>
            </ul>
          </section>

          <section aria-labelledby={reasonId}>
            <SectionLabel id={reasonId}>
              탈퇴 사유{" "}
              <span className="font-normal text-[var(--el-muted)]">(선택)</span>
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
                  {REASON_LABEL[code]}
                </button>
              ))}
            </div>
            {reason === "OTHER" ? (
              <div className="mt-3 grid gap-1.5">
                <Textarea
                  aria-label="기타 사유"
                  value={detail}
                  maxLength={WITHDRAWAL_DETAIL_MAX}
                  disabled={busy}
                  rows={3}
                  placeholder="개인정보는 적지 마세요."
                  onChange={(event) => setDetail(event.target.value)}
                />
                <span className="justify-self-end text-xs text-[var(--el-muted)] tabular-nums">
                  {detail.length} / {WITHDRAWAL_DETAIL_MAX}
                </span>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-[var(--el-muted)]">
              사유는 개인을 알 수 없게 통계로만 남습니다.
            </p>
          </section>

          <ConfirmPhraseField
            phrase={WITHDRAWAL_CONFIRMATION}
            value={typed}
            onChange={setTyped}
            disabled={busy}
          />

          {recordingNow ? (
            <p role="status" className="text-xs text-[var(--el-muted)]">
              녹음을 끝낸 뒤 탈퇴할 수 있습니다.
            </p>
          ) : null}
          {reauth.waiting ? (
            <p role="status" className="text-xs text-[var(--el-muted)]">
              Google 창에서 다시 로그인해 주세요.
            </p>
          ) : null}
          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-[var(--el-hairline)] px-5 py-4">
          <Button
            variant="outline"
            disabled={deleteAccount.isPending}
            onClick={() => {
              reauth.cancel();
              onClose();
            }}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            disabled={!ready}
            onClick={() => void submit()}
          >
            Google로 확인하고 탈퇴
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
  const groupName = useId();
  const fixed =
    row.action === "DELETE"
      ? "삭제 — 혼자 쓰는 워크스페이스입니다"
      : row.action === "LEAVE"
        ? "나가기 — 다른 사람은 계속 씁니다"
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
          <legend className="sr-only">{row.name} 처리</legend>
          <p className="text-xs text-[var(--el-muted)]">
            내가 유일한 관리자입니다. 관리자를 넘기거나 워크스페이스를
            삭제하세요.
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
              <span className="whitespace-nowrap">관리자 넘기기</span>
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
                aria-label={`${row.name} 관리자를 넘겨받을 사람`}
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
            워크스페이스 삭제 — 멤버 모두에게 메일이 갑니다
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
