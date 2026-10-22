"use client";

import {
  Check,
  ChevronDown,
  CircleAlert,
  FileText,
  Info,
  LoaderCircle,
  Paperclip,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { PdfPreview } from "@/components/notes/minutes/pdf-preview";
import { usePdfArtifact } from "@/components/notes/minutes/use-pdf-artifact";
import type { PrepareMinutesPdf } from "@/components/notes/minutes/render-minutes-pdf";
import { minutesFileName } from "@/lib/notes/minutes/model";

import { useAuth } from "@/components/auth/auth-provider";
import {
  EmailRecipientsInput,
  type RecipientGroup,
} from "@/components/heymoa/email-recipients-input";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import { okData } from "@/lib/api/ok-data";
import {
  useGetNoteShareMail,
  useSendNoteShareMail,
} from "@/lib/api/generated/notes/notes";
import type { SendNoteShareMailRequestIncludeItem } from "@/lib/api/generated/models";
import { formatAppDate, getAppDateKey } from "@/lib/format/date";
import {
  MAX_RECIPIENTS,
  addRecipients,
  hasRecipient,
  recipientProblem,
  type Recipient,
  type RecipientCandidate,
} from "@/lib/notes/share-mail/recipients";
import type { MinutesInclude } from "@/lib/notes/minutes/model";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

/**
 * 보낸 사람이 남기는 말의 상한. 정본은 서버의 공유 메일 도메인 상수(`NoteShareMail.MAX_MESSAGE_LENGTH`)이고
 * 넘기면 400 `SHARE_MAIL_MESSAGE_TOO_LONG` 이다. 여기서는 입력칸이 미리 막는다.
 */
const MAX_MESSAGE_LENGTH = 1000;

/** 서버가 받는 사람 때문에 거절한 코드. 토스트와 함께 입력칸 테두리도 붉힌다 */
const RECIPIENT_CODES = new Set([
  "SHARE_MAIL_INVALID_RECIPIENT",
  "SHARE_MAIL_TOO_MANY_RECIPIENTS",
]);

/**
 * 「회의록 보내기」. 넓은 화면은 가운데 대화상자, 좁은 화면(`< sm`)은 아래에서 올라오는 시트다 — 같은
 * 팝업의 기하만 CSS 로 바꾼다(첫 렌더가 화면 폭을 몰라도 갈리지 않는다).
 *
 * PDF 는 누를 때 [buildPdf] 로 만든다. 무엇을 붙일지만 넘기고, 회의록 모델은 부르는 쪽이 안다.
 * 실패는 전역 토스트(서버 문구)이고 창과 입력은 그대로 남는다.
 */
export function ShareMailDialog({
  open,
  onOpenChange,
  noteId,
  workspaceId,
  meeting,
  attendees,
  unnamedSpeakers,
  buildPdf,
  preparePdf,
  version = "initial",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  workspaceId: string | undefined;
  meeting: { title: string; whenIso: string };
  /** 이 회의 참석자 중 주소가 있는 사람 */
  attendees: readonly RecipientCandidate[];
  /** 녹취록에 이름 없이 나갈 화자의 표시 이름(「화자 C」) */
  unnamedSpeakers: readonly string[];
  buildPdf: (include: MinutesInclude) => Promise<Blob>;
  preparePdf?: PrepareMinutesPdf;
  version?: string;
}) {
  const { user } = useAuth();
  const recipientsId = useId();
  const problemId = useId();
  // 검토 화면의 담당 후보가 같은 키로 이미 읽어 두어 대개 캐시에서 온다. 창을 열 때만 구독한다
  const membersQuery = useGetWorkspaceMembers(workspaceId ?? "", {
    query: { enabled: open && Boolean(workspaceId) },
  });
  const members = (okData(membersQuery.data)?.members ?? [])
    .filter((member) => !hasRecipient(attendees, member.email))
    .map(({ name, email }) => ({ name, email }));
  const groups: RecipientGroup[] = [
    { label: "회의 참석자", people: attendees },
    { label: "워크스페이스 멤버", people: members },
  ];

  const [include, setInclude] = useState<MinutesInclude>({ transcript: false });
  const [previewed, setPreviewed] = useState(false);
  // **열 때마다 녹취록을 끈다** — 창은 닫혀도 마운트된 채라 지난번에 켠 녹취록이 다음 메일에 말없이 실렸다.
  // 받는 사람 · 메시지는 쓰다 만 것이라 남긴다(보내면 비운다)
  // 보낸 뒤에는 창을 닫지 않고 받는 사람별 결과를 그린다. [since] 는 결과를 다시 묻기 시작한 때다
  const [sent, setSent] = useState<{ mailId: string; since: number } | null>(
    null
  );
  const status = useShareMailStatus(noteId, sent);
  // 더 기다릴 것이 없는 발송이다. **서버가 끝났다고 할 때뿐이다** — 조회가 실패했거나 30초가 지나 묻기를 멈춘
  // 것은 끝난 것이 아니다. 그런 발송은 다시 열어도 결과 화면과 다시 확인을 남긴다
  const sentDone = status.mail?.completed === true;
  // 지금 추적하는 발송. 늦게 눌린 예전 토스트가 새 발송을 건드리지 않게 확인할 때 쓴다
  const sentRef = useRef(sent);
  useEffect(() => {
    sentRef.current = sent;
  });
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setInclude({ transcript: false });
      setPreviewed(false);
      // 아직 결과를 기다리는 발송이 있으면 그 결과 화면을 다시 연다 — 지우면 그 발송을 더 묻지 않아 뒤에 나온
      // 실패를 아무도 모른다. 끝난 발송만 걷고 새로 쓴다
      if (sentDone) setSent(null);
    }
  }

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [message, setMessage] = useState("");
  const [building, setBuilding] = useState(false);
  const sending = useRef(false);
  const sendMail = useSendNoteShareMail();
  const pdf = usePdfArtifact(
    open,
    version,
    include,
    preparePdf ??
      (async (option) => ({
        blob: await buildPdf(option),
        fileName: minutesFileName(meeting.title, meeting.whenIso),
      }))
  );
  const preview = async () => {
    try {
      await pdf.prepare();
      setPreviewed(true);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast.error(errorMessageOf(error, "회의록 PDF를 만들지 못했습니다."));
    }
  };

  const busy = building || pdf.pending || sendMail.isPending;
  const submitting = building || sendMail.isPending;
  const problem = recipientProblem(recipients);
  const rejected = RECIPIENT_CODES.has(errorCodeOf(sendMail.error) ?? "");
  const remainingAttendees = attendees.filter(
    (person) => !hasRecipient(recipients, person.email)
  );
  const day = formatAppDate(meeting.whenIso, { month: "long", day: "numeric" });

  const changeRecipients = (next: Recipient[]) => {
    setRecipients(next);
    // 서버가 받는 사람 때문에 거절한 표시는 고치기 시작하면 걷는다
    if (sendMail.isError) sendMail.reset();
  };

  const send = async () => {
    if (sending.current || busy) return;
    sending.current = true;
    let file: Blob;
    setBuilding(true);
    try {
      file = (await pdf.prepare()).blob;
    } catch (error) {
      sending.current = false;
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(errorMessageOf(error, "회의록 PDF를 만들지 못했습니다."));
      return;
    } finally {
      setBuilding(false);
    }
    // 회의록에는 붙임 「안건별 경과」가 없다(1쪽 안건 표와 상세가 그 자리다) — 계약의 AGENDA_LOG 는 보내지 않는다
    const kinds: SendNoteShareMailRequestIncludeItem[] = include.transcript
      ? ["TRANSCRIPT"]
      : [];
    sendMail.mutate(
      {
        noteId,
        data: {
          file,
          recipients: recipients.map((recipient) => recipient.email),
          message: message.trim() || undefined,
          include: kinds,
        },
      },
      {
        onSuccess: (response) => {
          sending.current = false;
          // 202 는 접수일 뿐이다(계약). 받는 사람별 결과는 이 창에서 이어 묻는다
          const mailId =
            response.status === 202 ? response.data.data?.mailId : undefined;
          if (!mailId) return;
          // 예전 발송의 실패 토스트는 거둔다 — 남겨 두면 그 「다시 보내기」가 새 발송 화면을 덮는다
          if (notified.current) toast.dismiss(`share-mail-${notified.current}`);
          setSent({ mailId, since: Date.now() });
          setRecipients([]);
          setMessage("");
        },
        onError: () => {
          sending.current = false;
        },
      }
    );
  };

  /** 「보내지 못함」 주소만 받는 사람 칸에 다시 채운다. 이유를 몰라 바로 보내지 않고 고칠 자리를 준다 */
  const retryFailed = (emails: readonly string[]) => {
    setRecipients(addRecipients([], [...emails], [...attendees, ...members]));
    setSent(null);
    sendMail.reset();
  };

  // **창을 닫은 뒤 나온 실패는 토스트로 알린다.** 창 안에서 최종 결과를 이미 봤으면 다시 알리지 않는다 — 모두
  // 「보냄」이면 아무것도 띄우지 않는다. 다시 보내기를 누르면 그 주소만 채운 창을 다시 연다
  const [seen, setSeen] = useState<string | null>(null);
  if (open && sent && status.mail?.completed && seen !== sent.mailId)
    setSeen(sent.mailId);
  const notified = useRef<string | null>(null);
  const { mail: finished, failed: unsent } = status;
  useEffect(() => {
    if (
      open ||
      !sent ||
      !finished?.completed ||
      seen === sent.mailId ||
      notified.current === sent.mailId
    )
      return;
    const { mailId } = sent;
    notified.current = mailId;
    if (unsent.length === 0) return;
    toast.error(`회의록 메일을 ${unsent.length}명에게 보내지 못했습니다.`, {
      id: `share-mail-${mailId}`,
      description: unsent.join(", "),
      action: {
        label: "다시 보내기",
        onClick: () => {
          // 그 사이 새 발송을 접수했으면 그 발송을 건드리지 않고 창만 연다
          if (sentRef.current?.mailId === mailId) retryFailed(unsent);
          onOpenChange(true);
        },
      },
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next || !submitting) && onOpenChange(next)}
    >
      <DialogContent
        showCloseButton={!submitting}
        className={cn(
          // **높이를 고정한다(APP-1356).** 글을 쓰는 화면(664)에서 보낸 결과(241)로 넘어가며 창이 절반 넘게 줄어 화면 가운데로
          // 튀었다. 두 화면 모두 본문만 스크롤하고 푸터는 아래에 붙는다
          "flex max-h-[calc(100dvh-3rem)] flex-col gap-0 p-0 sm:h-[min(720px,calc(100dvh-3rem))] sm:max-w-[520px]",
          // 좁은 화면은 아래 시트 — 손이 닿는 자리에 보내기가 오고, 키보드가 올라와도 위가 덜 가린다
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[92dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)] max-sm:data-open:slide-in-from-bottom-10"
        )}
      >
        <DialogHeader className="gap-1 px-5 pt-5 pb-1">
          <DialogTitle className="text-[17px] font-semibold">
            회의록 보내기
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {meeting.title} · {day}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <ShareMailResult
            status={status}
            // 30초를 새로 세고 지금 한 번 묻는다 — 실패한 조회는 묻기가 멈춰 있어 키만 그대로면 다시 나가지 않는다
            onRefresh={() => {
              setSent({ ...sent, since: Date.now() });
              void status.query.refetch();
            }}
            onRetryFailed={retryFailed}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-3.5 pb-1">
              <section aria-labelledby={`${recipientsId}-contents`}>
                <FieldLabel id={`${recipientsId}-contents`}>
                  보낼 내용
                </FieldLabel>
                <div className="overflow-hidden rounded-block border border-[var(--el-hairline)]">
                  <div className="flex items-center gap-2.5 bg-[var(--el-canvas-soft)] p-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-control bg-[var(--el-canvas)] text-[var(--el-ink)]">
                      <FileText className="size-[15px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block font-medium text-[var(--el-ink)]">
                        회의록
                      </b>
                      <span className="block text-[12.5px] text-[var(--el-muted)]">
                        핵심 요약 · 결정 · 할 일 · 미결 사항
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--el-muted)]">
                      기본 포함
                    </span>
                  </div>
                  <ToggleRow
                    title="녹취록"
                    description="시각 · 화자 · 발언을 고치지 않고 그대로 옮긴 기록입니다"
                    checked={include.transcript}
                    disabled={busy}
                    onChange={(transcript) => setInclude({ transcript })}
                  />
                </div>
              </section>

              {include.transcript && unnamedSpeakers.length > 0 ? (
                <InlineNote role="status">
                  녹취록에 이름 없는 화자 {unnamedSpeakers.length}명이{" "}
                  {unnamedSpeakers.map((name) => `「${name}」`).join(" · ")}{" "}
                  그대로 나갑니다. 보내기 전에 스크립트에서 이름을 지정할 수
                  있습니다.
                </InlineNote>
              ) : null}

              <div>
                <FieldLabel
                  htmlFor={recipientsId}
                  aside={`${recipients.length} / ${MAX_RECIPIENTS}`}
                >
                  받는 사람
                </FieldLabel>
                <EmailRecipientsInput
                  id={recipientsId}
                  value={recipients}
                  onChange={changeRecipients}
                  groups={groups}
                  disabled={submitting}
                  invalid={Boolean(problem) || rejected}
                  describedBy={problem ? problemId : undefined}
                />
                {/* 멤버를 못 불러온 것과 맞는 멤버가 없는 것은 다르다 — 빈 후보로 접으면 이름을 쳐도 아무도 없는 줄 안다 */}
                {membersQuery.isError && !membersQuery.data ? (
                  <InlineRetry
                    variant="line"
                    className="mt-2"
                    label="워크스페이스 멤버를 불러오지 못했습니다. 주소는 직접 입력할 수 있습니다."
                    onRetry={() => void membersQuery.refetch()}
                  />
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {attendees.length > 0 ? (
                    <button
                      type="button"
                      disabled={submitting || remainingAttendees.length === 0}
                      className="text-[13px] font-medium text-[var(--el-ink)] underline decoration-[var(--el-hairline-strong)] underline-offset-[3px] disabled:text-[var(--el-muted)] disabled:no-underline"
                      onClick={() =>
                        changeRecipients(
                          addRecipients(recipients, remainingAttendees)
                        )
                      }
                    >
                      {remainingAttendees.length
                        ? `참석자 모두 추가 (${remainingAttendees.length}명)`
                        : "참석자를 모두 추가했습니다"}
                    </button>
                  ) : null}
                  <span className="text-[12.5px] text-[var(--el-muted)]">
                    쉼표나 Enter로 여러 주소를 한 번에 넣을 수 있습니다
                  </span>
                </div>
              </div>

              {problem ? (
                <InlineNote id={problemId} role="alert" tone="error">
                  {problem}
                </InlineNote>
              ) : null}

              <div>
                <FieldLabel
                  htmlFor={`${recipientsId}-message`}
                  aside={
                    message.length
                      ? `${message.length} / ${MAX_MESSAGE_LENGTH.toLocaleString("ko-KR")}`
                      : undefined
                  }
                >
                  메시지 <span className="font-normal">(선택)</span>
                </FieldLabel>
                <Textarea
                  id={`${recipientsId}-message`}
                  value={message}
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={submitting}
                  placeholder="받는 분께 남길 말을 적으세요"
                  className="min-h-[72px] rounded-block"
                  onChange={(event) => setMessage(event.target.value)}
                />
              </div>

              <div>
                <Button
                  variant="outline"
                  loading={pdf.pending && !building}
                  disabled={building || sendMail.isPending}
                  onClick={() => void preview()}
                >
                  첨부 PDF 미리보기
                </Button>
                {previewed && pdf.artifact ? (
                  <PdfPreview blob={pdf.artifact.blob} />
                ) : null}
                {pdf.invalidated ? (
                  <p
                    role="status"
                    className="mt-2 text-sm text-[var(--el-muted)]"
                  >
                    내용이나 포함 항목이 바뀌었습니다. PDF를 다시 확인해 주세요.
                  </p>
                ) : null}
              </div>

              <MailPreview
                sender={user?.name ?? ""}
                recipients={recipients}
                meeting={meeting}
                day={day}
                message={message.trim()}
                include={include}
              />
            </div>

            <DialogFooter className="mx-0 mt-3.5 mb-0 rounded-b-panel bg-transparent px-5 pt-3.5 pb-4 max-sm:rounded-b-none">
              <DialogClose
                render={<Button variant="outline" disabled={submitting} />}
              >
                취소
              </DialogClose>
              <Button
                loading={submitting}
                disabled={busy || recipients.length === 0 || Boolean(problem)}
                onClick={() => void send()}
              >
                {recipients.length
                  ? `${recipients.length}명에게 보내기`
                  : "보내기"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 다시 묻는 간격과 그만 묻는 때(계약 합의). SES 응답은 보통 수 초 안에 끝난다 */
const POLL_MS = 2_000;
const POLL_FOR_MS = 30_000;

const STATUS_LABEL = {
  PENDING: "보내는 중",
  SENT: "보냄",
  FAILED: "보내지 못함",
} as const;

type ShareMailStatus = ReturnType<typeof useShareMailStatus>;

/**
 * 보낸 메일의 받는 사람별 결과를 묻는다. **창 밖에 둔다** — 창을 닫아도 30초까지는 계속 물어, 그 사이 「보내지 못함」이
 * 나오면 토스트로 알린다(창 안 결과만 보면 바로 닫은 사람은 실패를 모른다). 202 직후 한 번 묻고 2초마다 다시 묻다가,
 * 모두 끝났거나(`completed`) 30초가 지나거나 조회가 실패하면 멈춘다.
 */
function useShareMailStatus(
  noteId: string,
  sent: { mailId: string; since: number } | null
) {
  const query = useGetNoteShareMail(noteId, sent?.mailId ?? "", {
    query: {
      enabled: sent !== null,
      retry: false,
      refetchInterval: (current) => {
        const data = okData(current.state.data);
        if (!sent || data?.completed || current.state.status === "error")
          return false;
        return Date.now() - sent.since < POLL_FOR_MS ? POLL_MS : false;
      },
    },
  });
  const mail = sent ? okData(query.data) : null;
  const failed =
    mail?.recipients
      .filter((row) => row.status === "FAILED")
      .map((row) => row.email) ?? [];
  const pending = mail ? !mail.completed : true;
  // 그만 묻는 때를 렌더 밖(타이머)에서 알린다 — 다시 확인을 누르면 [since] 가 바뀌어 30초를 새로 센다
  const [expiredAt, setExpiredAt] = useState<number | null>(null);
  const since = sent?.since ?? null;
  useEffect(() => {
    if (since === null) return;
    const timer = window.setTimeout(
      () => setExpiredAt(since),
      Math.max(0, since + POLL_FOR_MS - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [since]);
  const polling = pending && !query.isError && expiredAt !== since;
  return { query, mail, failed, pending, polling };
}

/**
 * 보낸 뒤 받는 사람별 결과. 묻기는 [useShareMailStatus] 가 창 밖에서 하고 여기는 그리기만 한다.
 * 멈춘 뒤에도 「보내는 중」이 남으면 다시 확인할 버튼을 둔다(발송 큐가 밀리면 남는다).
 *
 * **「보냄」은 메일 서버(SES)가 받았다는 뜻이다** — 없는 주소로 되돌아와도 「보냄」으로 남는다(계약). 그래서
 * 「전달됨」이라고 쓰지 않는다.
 */
function ShareMailResult({
  status: { query, mail, failed, pending, polling },
  onRefresh,
  onRetryFailed,
  onClose,
}: {
  status: ShareMailStatus;
  onRefresh: () => void;
  onRetryFailed: (emails: readonly string[]) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-3.5 pb-1">
        {query.isError ? (
          <InlineRetry
            variant="line"
            label={errorMessageOf(
              query.error,
              "보낸 결과를 불러오지 못했습니다."
            )}
            onRetry={onRefresh}
          />
        ) : mail ? (
          <ul
            aria-label="받는 사람별 결과"
            className="divide-y divide-[var(--el-hairline)] rounded-block border border-[var(--el-hairline)]"
          >
            {mail.recipients.map((row) => (
              <li
                key={row.email}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13.5px]"
              >
                <span className="min-w-0 [overflow-wrap:anywhere] text-[var(--el-ink)]">
                  {row.email}
                </span>
                <StatusChip status={row.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p
            role="status"
            className="flex items-center gap-2 text-[13px] text-[var(--el-muted)]"
          >
            <LoaderCircle
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            보낸 결과를 확인하고 있습니다
          </p>
        )}
        {mail && pending && !polling ? (
          <InlineNote role="status">
            아직 보내는 중인 주소가 있습니다. 잠시 뒤 다시 확인해 주세요.{" "}
            <button
              type="button"
              className="font-medium underline underline-offset-[3px]"
              onClick={onRefresh}
            >
              다시 확인
            </button>
          </InlineNote>
        ) : null}
        {mail ? (
          <p className="text-[12.5px] text-[var(--el-muted)]">
            「보냄」은 메일 서버가 받았다는 뜻입니다. 받는 분의 메일함에
            들어갔는지까지는 알 수 없습니다.
          </p>
        ) : null}
      </div>
      <DialogFooter className="mx-0 mt-3.5 mb-0 rounded-b-panel bg-transparent px-5 pt-3.5 pb-4 max-sm:rounded-b-none">
        {/* 다시 보내기는 모두 끝난 뒤에만 — 아직 보내는 중인 주소가 있을 때 누르면 그 주소들의 결과를 놓친다 */}
        {failed.length && !pending ? (
          <Button variant="outline" onClick={() => onRetryFailed(failed)}>
            보내지 못한 {failed.length}명 다시 보내기
          </Button>
        ) : null}
        <Button onClick={onClose}>닫기</Button>
      </DialogFooter>
    </>
  );
}

function StatusChip({ status }: { status: keyof typeof STATUS_LABEL }) {
  const Icon =
    status === "PENDING"
      ? LoaderCircle
      : status === "SENT"
        ? Check
        : CircleAlert;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[12.5px]",
        status === "FAILED"
          ? "font-medium text-destructive"
          : "text-[var(--el-muted)]",
        status === "SENT" ? "text-[var(--el-ink)]" : null
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          status === "PENDING"
            ? "animate-spin motion-reduce:animate-none"
            : null
        )}
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function FieldLabel({
  children,
  htmlFor,
  id,
  aside,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  id?: string;
  aside?: string;
}) {
  const Tag = htmlFor ? "label" : "p";
  return (
    <div className="mb-2 flex items-baseline justify-between text-[12.5px] font-medium text-[var(--el-muted)]">
      <Tag id={id} htmlFor={htmlFor}>
        {children}
      </Tag>
      {aside ? <span className="tabular-nums">{aside}</span> : null}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="flex cursor-pointer items-center gap-3 border-t border-[var(--el-hairline)] p-3">
      <span className="min-w-0 flex-1">
        <b
          id={`${id}-title`}
          className="block font-medium text-[var(--el-ink)]"
        >
          {title}
        </b>
        <span
          id={`${id}-desc`}
          className="block text-[12.5px] text-[var(--el-muted)]"
        >
          {description}
        </span>
      </span>
      {/* 줄 전체가 label 이라 어디를 눌러도 켜진다. 이름은 제목만, 설명은 따로 읽힌다 */}
      <Switch
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </label>
  );
}

function InlineNote({
  children,
  id,
  role,
  tone = "info",
}: {
  children: React.ReactNode;
  id?: string;
  role: "status" | "alert";
  tone?: "info" | "error";
}) {
  return (
    <div
      id={id}
      role={role}
      className={cn(
        "flex items-start gap-2.5 rounded-block px-3 py-2.5 text-[13px] leading-relaxed",
        tone === "error"
          ? "bg-[var(--el-error)]/[0.06] text-[var(--el-error)]"
          : "bg-[var(--el-canvas-soft)] text-[var(--el-body)]"
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/**
 * 받는 사람이 볼 메일의 겉모양. 틀의 정본은 서버(메일 템플릿)이고 본문에는 회의록 내용을 싣지 않는다 —
 * 회의록은 첨부로만 간다. 보낸 사람 표시 · 제목 · 첨부 이름은 서버가 정한 모양을 그대로 따른다.
 */
function MailPreview({
  sender,
  recipients,
  meeting,
  day,
  message,
  include,
}: {
  sender: string;
  recipients: readonly Recipient[];
  meeting: { title: string; whenIso: string };
  day: string;
  message: string;
  include: MinutesInclude;
}) {
  const to =
    recipients
      .filter((recipient) => recipient.valid)
      .map((recipient) =>
        recipient.name
          ? `${recipient.name} <${recipient.email}>`
          : recipient.email
      )
      .join(", ") || "받는 사람을 추가하세요";
  const contents = include.transcript ? "회의록 · 녹취록" : "회의록";
  return (
    <details className="details-motion group rounded-block border border-[var(--el-hairline)]">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[13px] font-medium text-[var(--el-ink)] [&::-webkit-details-marker]:hidden">
        받는 사람에게 보이는 메일
        <ChevronDown
          className="size-3.5 transition-transform duration-200 ease-out group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-2.5 border-t border-[var(--el-hairline)] p-3.5 text-[13px] text-[var(--el-body)]">
        <dl className="grid grid-cols-[56px_1fr] gap-x-2 gap-y-0.5 text-xs">
          <dt className="text-[var(--el-muted)]">보낸 사람</dt>
          <dd className="text-[var(--el-ink)]">{sender} (HeyMoa)</dd>
          <dt className="text-[var(--el-muted)]">받는 사람</dt>
          <dd className="[overflow-wrap:anywhere] text-[var(--el-ink)]">
            {to}
          </dd>
          <dt className="text-[var(--el-muted)]">제목</dt>
          <dd className="text-[var(--el-ink)]">[회의록] {meeting.title}</dd>
        </dl>
        <p>{sender} 님이 회의록을 공유했습니다.</p>
        {message ? (
          <p className="border-l-2 border-[var(--el-hairline-strong)] pl-2.5 whitespace-pre-wrap text-[var(--el-ink)]">
            {message}
          </p>
        ) : null}
        <div>
          <p className="text-[15px] font-semibold text-[var(--el-ink)]">
            {meeting.title}
          </p>
          <p className="text-xs text-[var(--el-muted)]">{day}</p>
        </div>
        <p>첨부한 회의록을 확인하세요.</p>
        <div className="flex items-center gap-2 rounded-control border border-[var(--el-hairline)] px-2.5 py-2 text-[12.5px] text-[var(--el-ink)]">
          <Paperclip className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            회의록_{meeting.title}_
            {getAppDateKey(meeting.whenIso).replaceAll("-", "")}.pdf
          </span>
        </div>
        <p className="-mt-1 text-xs text-[var(--el-muted)]">
          첨부에 든 것: {contents}
        </p>
      </div>
    </details>
  );
}
