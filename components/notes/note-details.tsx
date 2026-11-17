"use client";

import { Fragment, useState } from "react";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/ui/toast";

import {
  INFO_LABEL,
  INFO_SECTION,
  INFO_SECTION_TITLE,
  NoteContextSection,
  NoteContextSkeleton,
} from "@/components/notes/note-context-section";
import { isAutoEnded } from "@/components/notes/note-auto-end-notice";
import { NoteParticipantsField } from "@/components/notes/note-participants-field";
import { ParticipantAvatar } from "@/components/notes/note-participants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetNoteSuspense,
  useUpdateNote,
} from "@/lib/api/generated/notes/notes";
import { formatAppDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import {
  deriveMeetingPhase,
  getRecordedDurationMs,
  recordingClockOriginMs,
} from "@/lib/notes/meeting-state";
import { invalidateNoteLifecycle } from "@/lib/notes/invalidate";
import { useAlignedNow } from "@/lib/notes/use-aligned-now";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

import { formatOffset as formatRecordedClock } from "@/lib/transcription/presentation";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className={INFO_LABEL}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      <dt className={cn("w-[124px] shrink-0", INFO_LABEL)}>{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--el-ink)]">
        {children}
      </dd>
    </div>
  );
}

function Body({
  children,
  ...rest
}: { children: React.ReactNode } & React.ComponentProps<"div">) {
  return (
    <div
      {...rest}
      className="mx-auto flex w-full max-w-[calc(820px+2*var(--note-gutter))] flex-col gap-6 px-[var(--note-gutter)] pb-36 pt-6"
    >
      {children}
    </div>
  );
}

function FactDivider() {
  return (
    <div aria-hidden className="my-2.5 h-px w-full bg-[var(--el-hairline)]" />
  );
}

export function NoteDetails({
  noteId,
  workspaceId,
  autoOpenParticipants,
  onParticipantsAutoOpened,
}: {
  noteId: string;
  autoOpenParticipants?: boolean;
  onParticipantsAutoOpened?: () => void;
  workspaceId?: string;
}) {
  const t = useTranslations("notes.details");
  const tActions = useTranslations("common.actions");
  const dateLocale = useDisplayLocale();
  const queryClient = useQueryClient();
  const noteResponse = useGetNoteSuspense(noteId).data;
  const updateNote = useUpdateNote({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [feedback, setFeedback] = useState<"saved" | null>(null);
  const [titleSaves, setTitleSaves] = useState(0);
  const loaded =
    noteResponse.status === 200 && noteResponse.data.success
      ? noteResponse.data.data
      : undefined;
  const clockOrigin = loaded ? recordingClockOriginMs(loaded) : null;
  const now = useAlignedNow(
    1_000,
    loaded?.meetingStatus === "IN_PROGRESS",
    clockOrigin === null ? [] : [clockOrigin]
  );

  if (!loaded) {
    throw new Error("Note response was empty");
  }
  const note = loaded;

  const refresh = () => invalidateNoteLifecycle(queryClient, noteId);

  const timestamp = (iso: string) =>
    formatAppDate(iso, { dateStyle: "medium", timeStyle: "short" }, dateLocale);

  return (
    <Body>
      <form
        key={`${note.noteId}-${note.title}-${titleSaves}`}
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setFeedback(null);
          const form = new FormData(event.currentTarget);
          const title = String(form.get("title") ?? "").trim();
          try {
            await updateNote.mutateAsync({
              noteId,
              data: {
                title: title || t("untitled"),
              },
            });
            await refresh();
            setTitleSaves((count) => count + 1);
            setFeedback("saved");
          } catch {
            toast.error(t("saveFailed"), {
              id: `note-save-${noteId}`,
            });
          }
        }}
      >
        <Field label={t("title")} htmlFor="note-title">
          <Input
            id="note-title"
            name="title"
            defaultValue={note.title}
            maxLength={200}
            className="h-9"
          />
        </Field>

        <Field label={t("attendees")}>
          <NoteParticipantsField
            noteId={noteId}
            projectId={note.projectId}
            workspaceId={workspaceId}
            participants={note.participants}
            autoOpen={autoOpenParticipants}
            onAutoOpened={onParticipantsAutoOpened}
          />
        </Field>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            loading={updateNote.isPending}
            className="rounded-control px-3.5"
          >
            <Check /> {tActions("saveChanges")}
          </Button>
          {feedback === "saved" ? (
            <span role="status" className="text-xs text-[var(--el-muted)]">
              {t("saved")}
            </span>
          ) : null}
        </div>
      </form>

      <NoteContextSection
        key={noteId}
        noteId={noteId}
        phase={deriveMeetingPhase(note)}
        topic={note.contextTopic}
        background={note.contextBackground}
      />

      <section aria-labelledby="note-facts-title" className={INFO_SECTION}>
        <h2 id="note-facts-title" className={cn("mb-3", INFO_SECTION_TITLE)}>
          {t("facts.title")}
        </h2>
        <dl className="flex flex-col">
          {note.meetingStartedBy ? (
            <Fact label={t("facts.host")}>
              <ParticipantAvatar
                participant={note.meetingStartedBy}
                size="sm"
                isStarter
              />
              <span className="ml-1 font-medium">
                {note.meetingStartedBy.name}
                <span className="font-normal text-[var(--el-muted)]">
                  {` · ${t("facts.controlsRecording")}`}
                </span>
              </span>
            </Fact>
          ) : null}
          <Fact label={t("facts.duration")}>
            <span
              role="timer"
              aria-label={t("facts.duration")}
              className="tabular-nums"
            >
              {formatRecordedClock(getRecordedDurationMs(note, now ?? 0))}
            </span>
          </Fact>
          <Fact label={t("facts.sharedWith")}>
            {t("facts.workspaceMembers")}
          </Fact>
          {isAutoEnded(note) && note.meetingEndedAt ? (
            <Fact label={t("facts.ended")}>
              <time dateTime={note.meetingEndedAt}>
                {timestamp(note.meetingEndedAt)}
              </time>
              <span className="font-normal text-[var(--el-muted)]">
                {` · ${
                  note.autoEnd?.pausedBusinessDays
                    ? t("facts.autoEndedDays", {
                        days: note.autoEnd.pausedBusinessDays,
                      })
                    : t("facts.autoEnded")
                }`}
              </span>
            </Fact>
          ) : null}

          <FactDivider />
          <Fact label={t("facts.created")}>
            <time dateTime={note.createdAt}>{timestamp(note.createdAt)}</time>
          </Fact>
          <Fact label={t("facts.updated")}>
            <time dateTime={note.updatedAt}>{timestamp(note.updatedAt)}</time>
          </Fact>
        </dl>
      </section>
    </Body>
  );
}

export function NoteDetailsSkeleton() {
  const t = useTranslations("notes.details");
  return (
    <Body aria-label={t("loading")}>
      <div className="flex flex-col gap-4">
        <Field label={t("title")}>
          <Skeleton className="h-9 w-full rounded-control" />
        </Field>
        <Field label={t("attendees")}>
          <Skeleton className="h-8 w-56 rounded-control" />
        </Field>
        <Skeleton className="h-8 w-[105px] rounded-control" />
      </div>
      <NoteContextSkeleton />
      <section className={INFO_SECTION}>
        <h2 className={cn("mb-3", INFO_SECTION_TITLE)}>{t("facts.title")}</h2>
        <dl className="flex flex-col">
          {FACT_ROWS.map(({ key, width }) => (
            <Fragment key={key}>
              {key === "created" ? <FactDivider /> : null}
              <Fact label={t(`facts.${key}`)}>
                <Skeleton className="h-3.5 rounded-chip" style={{ width }} />
              </Fact>
            </Fragment>
          ))}
        </dl>
      </section>
    </Body>
  );
}

const FACT_ROWS = [
  { key: "host", width: 180 },
  { key: "duration", width: 48 },
  { key: "sharedWith", width: 132 },
  { key: "created", width: 156 },
  { key: "updated", width: 156 },
] as const;
