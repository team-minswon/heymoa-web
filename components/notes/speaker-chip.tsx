import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { SpeakerFallbackNames } from "@/lib/notes/speaker-stats";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";
import { PersonAvatar } from "@/components/heymoa/person-avatar";

export function SpeakerChip({
  identity,
  className,
}: {
  identity: SpeakerIdentity;
  className?: string;
}) {
  const t = useTranslations("notes.speakers");
  return (
    <span
      data-testid="speaker-chip"
      data-unassigned={identity.unassigned || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--el-muted)]",
        className
      )}
    >
      <PersonAvatar name={identity.avatarName} image={identity.imageUrl} />
      {identity.displayName}
      {identity.unassigned ? (
        <span
          aria-label={t("unconfirmed")}
          className="size-1.5 shrink-0 rounded-full bg-[var(--el-muted-soft)]"
        />
      ) : null}
    </span>
  );
}

export function useSpeakerFallbackNames(): SpeakerFallbackNames {
  const t = useTranslations("notes.speakers");
  return useMemo(
    () => ({
      unnamedParticipant: t("unnamedParticipant"),
      speaker: (label: string) => t("fallback", { label }),
    }),
    [t]
  );
}
