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
import { useTranslations } from "next-intl";
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
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
import { useDocLanguage } from "@/lib/i18n/use-doc-language";

const MAX_MESSAGE_LENGTH = 1000;

const RECIPIENT_CODES = new Set(["SHARE_MAIL_INVALID_RECIPIENT"]);

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
  attendees: readonly RecipientCandidate[];
  unnamedSpeakers: readonly string[];
  buildPdf: (include: MinutesInclude) => Promise<Blob>;
  preparePdf?: PrepareMinutesPdf;
  version?: string;
}) {
  const t = useTranslations("notes.share.mail");
  const tMinutes = useTranslations("notes.minutes");
  const tAction = useTranslations("common.actions");
  const dateLocale = useDisplayLocale();
  const doc = useDocLanguage();
  const { user } = useAuth();
  const recipientsId = useId();
  const problemId = useId();
  const membersQuery = useGetWorkspaceMembers(workspaceId ?? "", {
    query: { enabled: open && Boolean(workspaceId) },
  });
  const members = (okData(membersQuery.data)?.members ?? [])
    .filter((member) => !hasRecipient(attendees, member.email))
    .map(({ name, email }) => ({ name, email }));
  const groups: RecipientGroup[] = [
    { label: t("groups.attendees"), people: attendees },
    { label: t("groups.members"), people: members },
  ];

  const [include, setInclude] = useState<MinutesInclude>({ transcript: false });
  const [previewed, setPreviewed] = useState(false);
  const [sent, setSent] = useState<{ mailId: string; since: number } | null>(
    null
  );
  const status = useShareMailStatus(noteId, sent);
  const sentDone = status.mail?.completed === true;
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
        fileName: minutesFileName(meeting.title, meeting.whenIso, doc),
      }))
  );
  const preview = async () => {
    try {
      await pdf.prepare();
      setPreviewed(true);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast.error(errorMessageOf(error, tMinutes("pdfFailed")));
    }
  };

  const busy = building || pdf.pending || sendMail.isPending;
  const submitting = building || sendMail.isPending;
  const problem = recipientProblem(recipients);
  const rejected = RECIPIENT_CODES.has(errorCodeOf(sendMail.error) ?? "");
  const remainingAttendees = attendees.filter(
    (person) => !hasRecipient(recipients, person.email)
  );
  const day = formatAppDate(
    meeting.whenIso,
    { month: "long", day: "numeric" },
    dateLocale
  );

  const changeRecipients = (next: Recipient[]) => {
    setRecipients(next);
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
      toast.error(errorMessageOf(error, tMinutes("pdfFailed")));
      return;
    } finally {
      setBuilding(false);
    }
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
          const mailId =
            response.status === 202 ? response.data.data?.mailId : undefined;
          if (!mailId) return;
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

  const retryFailed = (emails: readonly string[]) => {
    setRecipients(addRecipients([], [...emails], [...attendees, ...members]));
    setSent(null);
    sendMail.reset();
  };

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
    toast.error(t("unsent", { count: unsent.length }), {
      id: `share-mail-${mailId}`,
      description: unsent.join(", "),
      action: {
        label: t("resend"),
        onClick: () => {
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
          "flex max-h-[calc(100dvh-3rem)] flex-col gap-0 p-0 sm:h-[min(720px,calc(100dvh-3rem))] sm:max-w-[520px]",
          "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[92dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)] max-sm:data-open:slide-in-from-bottom-10"
        )}
      >
        <DialogHeader className="gap-1 px-5 pt-5 pb-1">
          <DialogTitle className="text-[17px] font-semibold">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {meeting.title} · {day}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <ShareMailResult
            status={status}
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
                  {t("contents")}
                </FieldLabel>
                <div className="overflow-hidden rounded-block border border-[var(--el-hairline)]">
                  <div className="flex items-center gap-2.5 bg-[var(--el-canvas-soft)] p-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-control bg-[var(--el-canvas)] text-[var(--el-ink)]">
                      <FileText className="size-[15px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block font-medium text-[var(--el-ink)]">
                        {t("minutes")}
                      </b>
                      <span className="block text-[12.5px] text-[var(--el-muted)]">
                        {t("minutesParts")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--el-muted)]">
                      {t("included")}
                    </span>
                  </div>
                  <ToggleRow
                    title={t("transcript")}
                    description={t("transcriptHint")}
                    checked={include.transcript}
                    disabled={busy}
                    onChange={(transcript) => setInclude({ transcript })}
                  />
                </div>
              </section>

              {include.transcript && unnamedSpeakers.length > 0 ? (
                <InlineNote role="status">
                  {t("unnamed", {
                    count: unnamedSpeakers.length,
                    names: unnamedSpeakers.join(", "),
                  })}
                </InlineNote>
              ) : null}

              <div>
                <FieldLabel
                  htmlFor={recipientsId}
                  aside={`${recipients.length} / ${MAX_RECIPIENTS}`}
                >
                  {t("recipients")}
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
                {membersQuery.isError && !membersQuery.data ? (
                  <InlineRetry
                    variant="line"
                    className="mt-2"
                    label={t("membersFailed")}
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
                        ? t("addAttendees", {
                            count: remainingAttendees.length,
                          })
                        : t("attendeesAdded")}
                    </button>
                  ) : null}
                  <span className="text-[12.5px] text-[var(--el-muted)]">
                    {t("recipientsHint")}
                  </span>
                </div>
              </div>

              {problem ? (
                <InlineNote id={problemId} role="alert" tone="error">
                  {problem.kind === "invalid"
                    ? t("problem.invalid", { emails: problem.emails })
                    : t("problem.tooMany", {
                        max: problem.max,
                        extra: problem.extra,
                      })}
                </InlineNote>
              ) : null}

              <div>
                <FieldLabel
                  htmlFor={`${recipientsId}-message`}
                  aside={
                    message.length
                      ? `${message.length} / ${MAX_MESSAGE_LENGTH.toLocaleString(dateLocale)}`
                      : undefined
                  }
                >
                  {t("message")}{" "}
                  <span className="font-normal">{t("optional")}</span>
                </FieldLabel>
                <Textarea
                  id={`${recipientsId}-message`}
                  value={message}
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={submitting}
                  placeholder={t("messagePlaceholder")}
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
                  {t("previewPdf")}
                </Button>
                {previewed && pdf.artifact ? (
                  <PdfPreview blob={pdf.artifact.blob} />
                ) : null}
                {pdf.invalidated ? (
                  <p
                    role="status"
                    className="mt-2 text-sm text-[var(--el-muted)]"
                  >
                    {tMinutes("invalidated")}
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
                {tAction("cancel")}
              </DialogClose>
              <Button
                loading={submitting}
                disabled={busy || recipients.length === 0 || Boolean(problem)}
                onClick={() => void send()}
              >
                {recipients.length
                  ? t("send", { count: recipients.length })
                  : t("sendEmpty")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const POLL_MS = 2_000;
const POLL_FOR_MS = 30_000;

type MailStatus = "PENDING" | "SENT" | "FAILED";

type ShareMailStatus = ReturnType<typeof useShareMailStatus>;

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

/** 「보냄」은 메일 서버(SES)가 받았다는 뜻이다 — 없는 주소로 되돌아와도 「보냄」으로 남는다(계약). 그래서 「전달됨」이라 쓰지 않는다. */
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
  const t = useTranslations("notes.share.mail");
  const tAction = useTranslations("common.actions");
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-3.5 pb-1">
        {query.isError ? (
          <InlineRetry
            variant="line"
            label={errorMessageOf(query.error, t("resultFailed"))}
            onRetry={onRefresh}
          />
        ) : mail ? (
          <ul
            aria-label={t("resultLabel")}
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
            {t("checking")}
          </p>
        )}
        {mail && pending && !polling ? (
          <InlineNote role="status">
            {t("stillSending")}{" "}
            <button
              type="button"
              className="font-medium underline underline-offset-[3px]"
              onClick={onRefresh}
            >
              {t("recheck")}
            </button>
          </InlineNote>
        ) : null}
        {mail ? (
          <p className="text-[12.5px] text-[var(--el-muted)]">
            {t("sentMeaning")}
          </p>
        ) : null}
      </div>
      <DialogFooter className="mx-0 mt-3.5 mb-0 rounded-b-panel bg-transparent px-5 pt-3.5 pb-4 max-sm:rounded-b-none">
        {failed.length && !pending ? (
          <Button variant="outline" onClick={() => onRetryFailed(failed)}>
            {t("resendFailed", { count: failed.length })}
          </Button>
        ) : null}
        <Button onClick={onClose}>{tAction("close")}</Button>
      </DialogFooter>
    </>
  );
}

function StatusChip({ status }: { status: MailStatus }) {
  const t = useTranslations("notes.share.mail.status");
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
      {t(status)}
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
  const t = useTranslations("notes.share.mail.preview");
  const dateLocale = useDisplayLocale();
  const language = dateLocale === "en-US" ? "en" : "ko";
  const to =
    recipients
      .filter((recipient) => recipient.valid)
      .map((recipient) =>
        recipient.name
          ? `${recipient.name} <${recipient.email}>`
          : recipient.email
      )
      .join(", ") || t("noRecipients");
  const contents = include.transcript
    ? t("contentsBoth")
    : t("contentsMinutes");
  return (
    <details className="details-motion group rounded-block border border-[var(--el-hairline)]">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[13px] font-medium text-[var(--el-ink)] [&::-webkit-details-marker]:hidden">
        {t("title")}
        <ChevronDown
          className="size-3.5 transition-transform duration-200 ease-out group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-2.5 border-t border-[var(--el-hairline)] p-3.5 text-[13px] text-[var(--el-body)]">
        <p className="text-xs text-[var(--el-muted)]">{t("languageNote")}</p>
        <dl className="grid grid-cols-[56px_1fr] gap-x-2 gap-y-0.5 text-xs">
          <dt className="text-[var(--el-muted)]">{t("from")}</dt>
          <dd className="text-[var(--el-ink)]">{sender} (HeyMoa)</dd>
          <dt className="text-[var(--el-muted)]">{t("to")}</dt>
          <dd className="[overflow-wrap:anywhere] text-[var(--el-ink)]">
            {to}
          </dd>
          <dt className="text-[var(--el-muted)]">{t("subject")}</dt>
          <dd lang={language} className="text-[var(--el-ink)]">
            {t("subjectLine", { title: meeting.title })}
          </dd>
        </dl>
        <p lang={language}>{t("sharedBy", { sender })}</p>
        {message ? (
          <p className="border-l-2 border-[var(--el-hairline-strong)] pl-2.5 whitespace-pre-wrap text-[var(--el-ink)]">
            {message}
          </p>
        ) : null}
        <div>
          <p className="text-[15px] font-semibold text-[var(--el-ink)]">
            {meeting.title}
          </p>
          <p lang={language} className="text-xs text-[var(--el-muted)]">
            {day}
          </p>
        </div>
        <p lang={language}>{t("body")}</p>
        <div className="flex items-center gap-2 rounded-control border border-[var(--el-hairline)] px-2.5 py-2 text-[12.5px] text-[var(--el-ink)]">
          <Paperclip className="size-3.5 shrink-0" aria-hidden />
          <span lang={language} className="min-w-0 [overflow-wrap:anywhere]">
            {t("fileName", {
              title: meeting.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 50),
              day: getAppDateKey(meeting.whenIso).replaceAll("-", ""),
            })}
          </span>
        </div>
        <p className="-mt-1 text-xs text-[var(--el-muted)]">
          {t("attachment", { contents })}
        </p>
      </div>
    </details>
  );
}
