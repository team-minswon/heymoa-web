"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { HelpTip } from "@/components/ui/help-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorCodeOf } from "@/lib/api/error-message";
import {
  getGetNoteQueryKey,
  useUpdateNoteContext,
} from "@/lib/api/generated/notes/notes";
import type { MeetingPhase } from "@/lib/notes/meeting-state";
import { invalidateNoteLifecycle } from "@/lib/notes/invalidate";
import { cn } from "@/lib/utils";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

export const TOPIC_MAX = 200;
export const BACKGROUND_MAX = 1000;
const SAVE_DELAY_MS = 800;

export const INFO_SECTION_TITLE =
  "text-base font-semibold text-[var(--el-ink)]";
export const INFO_LABEL =
  "text-[13px] font-medium tracking-[0.01em] text-[var(--el-muted)]";
export const INFO_SECTION =
  "flex flex-col border-t border-[var(--el-hairline)] pt-6";

type Context = { topic: string; background: string };
const normalize = (value: Context) => ({
  topic: value.topic.trim() || null,
  background: value.background.trim() || null,
});
const sameContext = (a: Context, b: Context) => {
  const x = normalize(a);
  const y = normalize(b);
  return x.topic === y.topic && x.background === y.background;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function FieldLabel({
  htmlFor,
  label,
  length,
  max,
}: {
  htmlFor?: string;
  label: string;
  length?: number;
  max?: number;
}) {
  const dateLocale = useDisplayLocale();
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Label htmlFor={htmlFor} className={INFO_LABEL}>
        {label}
      </Label>
      {max !== undefined && length ? (
        <span
          className={cn(
            "text-xs tabular-nums",
            length >= max
              ? "text-[var(--el-ink)]"
              : "text-[var(--el-muted-soft)]"
          )}
        >
          {length.toLocaleString(dateLocale)} / {max.toLocaleString(dateLocale)}
        </span>
      ) : null}
    </div>
  );
}

function SectionHeading({ status }: { status?: React.ReactNode }) {
  const t = useTranslations("notes.context");
  return (
    <div className="mb-4 flex min-h-6 items-center justify-between gap-3">
      <h2
        id="note-context-title"
        className={cn("flex items-center gap-1", INFO_SECTION_TITLE)}
      >
        {t("title")}
        <HelpTip label={t("title")}>{t("help")}</HelpTip>
      </h2>
      {status}
    </div>
  );
}

export function NoteContextSection({
  noteId,
  phase,
  topic,
  background,
}: {
  noteId: string;
  phase: MeetingPhase;
  topic: string | null;
  background: string | null;
}) {
  const t = useTranslations("notes.context");
  const server: Context = { topic: topic ?? "", background: background ?? "" };
  const [unsaved, setUnsaved] = useState<Context | null>(null);

  if (phase === "ended") {
    return (
      <section aria-labelledby="note-context-title" className={INFO_SECTION}>
        <SectionHeading />
        {server.topic || server.background ? (
          <dl className="flex flex-col gap-5">
            <ReadOnlyValue label={t("topic")} value={server.topic} emphasis />
            <ReadOnlyValue label={t("background")} value={server.background} />
          </dl>
        ) : (
          <p className="text-sm text-[var(--el-muted)]">
            {t("empty")}
          </p>
        )}
        {unsaved && !sameContext(unsaved, server) ? (
          <div className="mt-4 flex flex-col gap-2 rounded-control border border-dashed border-[var(--el-hairline-strong)] p-3">
            <p className="text-xs text-[var(--el-body)]">
              {t("unsaved")}
            </p>
            <dl className="flex flex-col gap-5 select-text">
              <ReadOnlyValue
                label={t("topic")}
                value={unsaved.topic}
                emphasis
              />
              <ReadOnlyValue
                label={t("background")}
                value={unsaved.background}
              />
            </dl>
          </div>
        ) : null}
      </section>
    );
  }
  return (
    <EditableContext
      key={noteId}
      noteId={noteId}
      recording={phase === "active"}
      server={server}
      onEnded={setUnsaved}
    />
  );
}

function ReadOnlyValue({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  const t = useTranslations("notes.context");
  return (
    <div className="flex flex-col gap-1.5">
      <dt className={INFO_LABEL}>{label}</dt>
      <dd
        className={cn(
          "flex flex-col gap-3 break-words text-[15px] leading-[1.7]",
          !value
            ? "text-[var(--el-muted)]"
            : cn("text-[var(--el-ink)]", emphasis && "font-medium")
        )}
      >
        {value
          ? value.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-wrap">
                {paragraph}
              </p>
            ))
          : t("blank")}
      </dd>
    </div>
  );
}

function EditableContext({
  noteId,
  recording,
  server,
  onEnded,
}: {
  noteId: string;
  recording: boolean;
  server: Context;
  onEnded: (draft: Context) => void;
}) {
  const t = useTranslations("notes.context");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const update = useUpdateNoteContext();
  const [draft, setDraft] = useState<Context>(server);
  const [state, setState] = useState<SaveState>("idle");
  const [touched, setTouched] = useState(false);

  const [seen, setSeen] = useState<Context>(server);
  if (seen.topic !== server.topic || seen.background !== server.background) {
    setSeen(server);
    if (!touched) setDraft(server);
  }

  const latest = useRef(draft);
  const sent = useRef<Context>(server);
  useEffect(() => {
    sent.current = { topic: seen.topic, background: seen.background };
  }, [seen.topic, seen.background]);
  const inFlight = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  const flush = useRef<() => void>(() => {});
  useEffect(
    () => () => {
      if (timer.current) flush.current();
    },
    []
  );

  const save = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    const value = latest.current;
    if (sameContext(value, sent.current)) {
      setTouched(false);
      setState((current) => (current === "error" ? "saved" : current));
      return;
    }
    inFlight.current = true;
    setState("saving");
    try {
      const response = await update.mutateAsync({
        noteId,
        data: normalize(value),
      });
      if (response.status === 200 && response.data.success) {
        sent.current = value;
        await queryClient.cancelQueries({
          queryKey: getGetNoteQueryKey(noteId),
        });
        queryClient.setQueryData(getGetNoteQueryKey(noteId), response);
        if (sameContext(latest.current, value)) setTouched(false);
        setState("saved");
      }
    } catch (error) {
      setState("error");
      if (errorCodeOf(error) === "MEETING_ALREADY_ENDED") {
        onEnded(latest.current);
        void invalidateNoteLifecycle(queryClient, noteId);
      }
      again.current = false;
    } finally {
      inFlight.current = false;
    }
    if (again.current) {
      again.current = false;
      void save();
    }
  };

  useEffect(() => {
    flush.current = () => void save();
  });

  const change = (next: Context) => {
    setDraft(next);
    setTouched(true);
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
  };

  const status =
    state === "saving" ? (
      <span className="text-xs text-[var(--el-muted)]">{t("saving")}</span>
    ) : state === "saved" ? (
      <span className="text-xs text-[var(--el-muted)]">{t("saved")}</span>
    ) : state === "error" ? (
      <span className="flex items-center gap-1.5 text-xs text-[var(--el-error-strong)]">
        {t("saveFailed")}
        <button
          type="button"
          onClick={() => void save()}
          className="cursor-pointer font-medium underline underline-offset-2 hover:text-[var(--el-ink)]"
        >
          {tActions("retry")}
        </button>
      </span>
    ) : null;

  return (
    <section
      aria-labelledby="note-context-title"
      className={INFO_SECTION}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null))
          return;
        void save();
      }}
    >
      <SectionHeading
        status={
          <p role="status" aria-live="polite">
            {status}
          </p>
        }
      />
      {recording ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-[var(--el-body)]">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-[var(--el-error)]"
          />
          {t("recording")}
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel
            htmlFor="note-context-topic"
            label={t("topic")}
            length={draft.topic.length}
            max={TOPIC_MAX}
          />
          <Input
            id="note-context-topic"
            value={draft.topic}
            maxLength={TOPIC_MAX}
            autoComplete="off"
            placeholder={t("topicPlaceholder")}
            onChange={(event) =>
              change({ ...draft, topic: event.target.value })
            }
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel
            htmlFor="note-context-background"
            label={t("background")}
            length={draft.background.length}
            max={BACKGROUND_MAX}
          />
          <Textarea
            id="note-context-background"
            value={draft.background}
            maxLength={BACKGROUND_MAX}
            placeholder={t("backgroundPlaceholder")}
            onChange={(event) =>
              change({ ...draft, background: event.target.value })
            }
            className="min-h-[88px] max-h-60 resize-none"
          />
        </div>
      </div>
    </section>
  );
}

export function NoteContextSkeleton() {
  const t = useTranslations("notes.context");
  return (
    <section className={INFO_SECTION}>
      <div className="mb-4 flex min-h-6 items-center">
        <h2 className={INFO_SECTION_TITLE}>{t("title")}</h2>
      </div>
      <div className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-40 rounded-chip" />
      </div>
    </section>
  );
}
